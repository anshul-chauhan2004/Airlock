# Third-party components

Airlock's Apache-2.0 license covers its original code. Dependencies retain their own licenses; installing and bundling them does not relicense them.

The locked dependency versions are recorded in `package-lock.json`. Original license texts are available in each installed package. The extension build copies Tesseract notices into `ocr/` and PDF font and character-map notices into `pdf/`. Vite also preserves dependency license comments in generated code where applicable.

Key components include Firebase JavaScript SDK (Apache-2.0), React (MIT), PDF.js (Apache-2.0), Mammoth (BSD-2-Clause), Tesseract.js and Tesseract.js Core (Apache-2.0), and Inter fonts (SIL Open Font License 1.1). Language data, PDF fonts, and character maps have their own bundled notices. Preserve those notices when redistributing builds.
