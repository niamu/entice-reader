# Entice Reader

The `<entice-reader>` HTML web component assists in progressively enhancing text which is accompanied by an audio narration.

When the audio is playing, the currently spoken word is highlighted in the text.

This is still currently a rough proof-of-concept, but could later be expanded to process local epub libraries where accompanying audiobooks are also available.

## Prerequisites

Apart from the aforementioned HTML text and matching audio file, you'll need to generate a timeline JSON file including the timestamps of when each word is spoken in the text.

I used [echogarden](https://github.com/echogarden-project/echogarden) for this:

```bash
echogarden align audio.opus transcript.txt timeline.json
```

## Usage

```html
<head>
    ...
    <script type="module" src="entice-reader.mjs"></script>
    ...
</head>
```

```html
<entice-reader data-timeline="timeline.json">
    <audio controls src="hello_world.mp3"></audio>
    <section>
        <p>Hello, world!</p>
    </section>
</entice-reader>
```

Your text should reside in a `<section>` tag within the component. Fill in the appropriate paths to your own JSON timeline in the `data-timeline` attribute of the component and the `<audio>` source.

Don't forget to include the `entice-reader.mjs` module to load the component interactivity in the `<head>` of your document.

## Demo

[See the `<entice-reader>` HTML web component](https://niamu.github.io/entice-reader) in action.

## License

With the exception of the materials used from [Resilient Web Design](https://resilientwebdesign.com) by [Jeremy Keith](https://adactio.com) and generated `timeline.json` file, all other aspects of this project are licensed under the Eclipse Public License 2.0.
