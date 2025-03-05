class EnticeReader extends HTMLElement {
  constructor() {
    super();
  }

  detectTextSegments() {
    // NOTE: This must match the segments in the timeline
    return this.querySelectorAll("section > *");
  }

  nodesInRange(node, start_index, end_index) {
    let result = [];
    if (
      node.range[0] <= start_index <= node.range[1] ||
      node.range[0] <= end_index <= node.range[1]
    ) {
      if (node.children) {
        result.push(
          node.children.flatMap((n) => {
            return this.nodesInRange(n, start_index, end_index);
          }),
        );
      } else {
        result.push(node);
      }
    }
    return result.flat();
  }

  highlightRange(element, start_index, end_index) {
    const segment = this.textRangeTree(element);
    const nodes = this.nodesInRange(segment, start_index, end_index);

    for (const node of nodes) {
      const string_before = node.reference.textContent.slice(
        0,
        Math.max(0, start_index - node.range[0]),
      );
      const string_highlight = node.reference.textContent.slice(
        Math.max(0, start_index - node.range[0]),
        Math.min(end_index - node.range[0], node.range[1]),
      );
      const string_after = node.reference.textContent.slice(
        Math.min(end_index - node.range[0], node.range[1]),
      );

      const highlight = document.createElement("span");
      highlight.classList.add("highlight");
      highlight.textContent = string_highlight;

      const span = document.createElement("span");
      span.appendChild(document.createTextNode(string_before));
      span.appendChild(highlight);
      span.appendChild(document.createTextNode(string_after));
      node.reference.replaceWith(span);
    }

    return segment;
  }

  textRangeTree(segment, nestedRange) {
    const original = segment.cloneNode(true);
    let range = [];
    let prevRangeEnd = !!nestedRange ? nestedRange : 0;
    range = [prevRangeEnd, segment.textContent.length];
    let result = {
      reference: segment,
      original,
      range,
    };
    if (segment.childNodes.length) {
      result.children = Array.from(segment.childNodes)
        .filter((element) => {
          // Ignore whitespace text nodes
          return !(
            element.nodeType == Node.TEXT_NODE &&
            element.textContent.replace(/\s+/g, "") == ""
          );
        })
        .map((element) => {
          // Ensure no whitespace in text content for accurate matching
          element.textContent = element.textContent.replace(/\s+/g, " ").trim();
          return element;
        })
        .reduce((acc, element) => {
          prevRangeEnd = !!acc.length
            ? acc[acc.length - 1].range[1]
            : prevRangeEnd;
          acc.push(this.textRangeTree(element, prevRangeEnd));
          return acc;
        }, []);
    }
    return result;
  }

  async loadTimelineSegments() {
    const timeline = this.dataset.timeline;
    const response = await fetch(timeline);
    return await response.json();
  }

  processSegment(segmentIndex) {
    if (segmentIndex < 0) return;
    const segment = this.timelineSegments[segmentIndex];

    const sentences = segment.timeline;
    const currentSentenceIndex = sentences.findIndex((segment) => {
      return (
        segment.startTime <= this.audio.currentTime &&
        segment.endTime >= this.audio.currentTime
      );
    });
    if (currentSentenceIndex < 0) return;

    const words = segment.timeline[currentSentenceIndex].timeline;
    const currentWordIndex = words.findIndex((segment) => {
      return (
        segment.startTime <= this.audio.currentTime &&
        segment.endTime >= this.audio.currentTime
      );
    });
    if (currentWordIndex < 0) return;

    const remainingSentences = sentences
      .slice(0, currentSentenceIndex)
      .reduce((accl, sentence) => {
        const idx = accl.indexOf(sentence.text);
        if (idx < 0) {
          return accl;
        } else {
          return accl.slice(idx + sentence.text.length);
        }
      }, segment.text);

    const remainingWords = sentences[currentSentenceIndex].timeline
      .slice(0, currentWordIndex + 1)
      .reduce((accl, word) => {
        const idx = accl.indexOf(word.text);
        if (idx < 0) {
          return accl;
        } else {
          return accl.slice(idx);
        }
      }, remainingSentences);

    const startOfCurrentSentence = segment.text.indexOf(
      remainingSentences.trim(),
    );
    const startOfCurrentWord = segment.text
      .slice(startOfCurrentSentence)
      .indexOf(remainingWords.trim());
    const highlightIndexStart = startOfCurrentSentence + startOfCurrentWord;
    const highlightIndexEnd =
      highlightIndexStart + words[currentWordIndex].text.length;

    if (
      this.currentlyHighlighted &&
      this.currentlyHighlighted[0] == segmentIndex &&
      this.currentlyHighlighted[1] == currentSentenceIndex &&
      this.currentlyHighlighted[2] == currentWordIndex &&
      this.currentlyHighlighted[3] == highlightIndexStart &&
      this.currentlyHighlighted[4] == highlightIndexEnd
    ) {
      // No need to highlight anything new
    } else {
      // Reset the previous segment elements before new highlighting
      this.detectedSegmentTexts[Math.max(segmentIndex - 1, 0)].innerHTML =
        this.originalSegments[Math.max(segmentIndex - 1, 0)].innerHTML;
      this.currentlyHighlighted = [
        segmentIndex,
        currentSentenceIndex,
        currentWordIndex,
        highlightIndexStart,
        highlightIndexEnd,
      ];
      this.highlightRange(
        this.detectedSegmentTexts[segmentIndex],
        highlightIndexStart,
        highlightIndexEnd,
      );
    }
  }

  processFrame() {
    requestAnimationFrame(() => {
      if (this.audio.paused) return;
      const currentSegmentIndex = this.timelineSegments.findIndex((segment) => {
        return (
          segment.startTime <= this.audio.currentTime &&
          segment.endTime >= this.audio.currentTime
        );
      });
      this.processSegment(currentSegmentIndex);
      this.processFrame();
    });
  }

  reset() {
    this.currentlyHighlighted = null;
    for (let i = 0; i < this.detectedSegmentTexts.length; i++) {
      this.detectedSegmentTexts[i].innerHTML =
        this.originalSegments[i].innerHTML;
    }
  }

  async connectedCallback() {
    this.timelineSegments = await this.loadTimelineSegments();
    this.detectedSegmentTexts = this.detectTextSegments();
    this.originalSegments = Array.from(this.detectedSegmentTexts).map((el) => {
      return el.cloneNode(true);
    });
    this.audio = this.querySelector("audio");
    this.audioPlayHandler = (_) => {
      this.reset();
      this.processFrame();
    };
    this.audio.addEventListener("play", this.audioPlayHandler);
    this.resetHandler = (_) => {
      this.reset();
    };
    this.audio.addEventListener("seeked", this.resetHandler);
    this.audio.addEventListener("ended", this.resetHandler);
  }

  disconnectedCallback() {
    this.audio.removeEventListener("play", this.audioPlayHandler);
    this.audio.removeEventListener("seeked", this.resetHandler);
    this.audio.removeEventListener("ended", this.resetHandler);
  }
}

customElements.define("entice-reader", EnticeReader);
