# Converthings (still developing)

<b>A self-hosted web file converter</b>
 

# Supported Conversion Formats

## Image

| Target Format | Supported Input Formats |
|--------------|------------------------|
| jpg | jpeg, png, gif, webp, bmp, tif, tiff, ico, heic, avif |
| jpeg | jpg, png, gif, webp, bmp, tif, tiff, ico, heic, avif |
| png | jpg, jpeg, gif, webp, bmp, tif, tiff, ico, heic, avif |
| gif | jpg, jpeg, png, webp, bmp, tif, tiff, ico, heic, avif |
| webp | jpg, jpeg, png, gif, bmp, tif, tiff, ico, heic, avif |
| bmp | jpg, jpeg, png, gif, webp, tif, tiff, ico, heic, avif |
| tif | jpg, jpeg, png, gif, webp, bmp, ico, heic, avif |
| tiff | jpg, jpeg, png, gif, webp, bmp, ico, heic, avif |
| ico | jpg, jpeg, png, gif, webp, bmp, tif, tiff, heic, avif |
| heic | jpg, jpeg, png, gif, webp, bmp, tif, tiff, ico, avif |
| avif | jpg, jpeg, png, gif, webp, bmp, tif, tiff, ico, heic |
| svg | png, jpg, jpeg, webp, bmp, tif, tiff, ico |

## Video

| Target Format | Supported Input Formats |
|--------------|------------------------|
| mp4 | mov, mkv, webm, avi, flv, wmv, m4v, mpg, mpeg, 3gp |
| mov | mp4, mkv, webm, avi, flv, wmv, m4v, mpg, mpeg, 3gp |
| mkv | mp4, mov, webm, avi, flv, wmv, m4v, mpg, mpeg, 3gp |
| webm | mp4, mov, mkv, avi, flv, wmv, m4v, mpg, mpeg, 3gp |
| avi | mp4, mov, mkv, webm, flv, wmv, m4v, mpg, mpeg, 3gp |
| flv | mp4, mov, mkv, webm, avi, wmv, m4v, mpg, mpeg, 3gp |
| wmv | mp4, mov, mkv, webm, avi, flv, m4v, mpg, mpeg, 3gp |
| m4v | mp4, mov, mkv, webm, avi, flv, wmv, mpg, mpeg, 3gp |
| mpg | mp4, mov, mkv, webm, avi, flv, wmv, m4v, mpeg, 3gp |
| mpeg | mp4, mov, mkv, webm, avi, flv, wmv, m4v, mpg, 3gp |
| 3gp | mp4, mov, mkv, webm, avi, flv, wmv, m4v, mpg, mpeg |

## Audio

| Target Format | Supported Input Formats |
|--------------|------------------------|
| mp3 | wav, ogg, flac, aac, m4a, wma, opus, amr |
| wav | mp3, ogg, flac, aac, m4a, wma, opus, amr |
| ogg | mp3, wav, flac, aac, m4a, wma, opus, amr |
| flac | mp3, wav, ogg, aac, m4a, wma, opus, amr |
| aac | mp3, wav, ogg, flac, m4a, wma, opus, amr |
| m4a | mp3, wav, ogg, flac, aac, wma, opus, amr |
| wma | mp3, wav, ogg, flac, aac, m4a, opus, amr |
| opus | mp3, wav, ogg, flac, aac, m4a, wma, amr |
| amr | mp3, wav, ogg, flac, aac, m4a, wma, opus |

## Document

### Word Processing

| Target Format | Supported Input Formats |
|--------------|------------------------|
| docx | pdf, doc, odt, rtf, txt, html, epub |
| doc | pdf, docx, odt, rtf, txt, html |
| odt | pdf, docx, doc, rtf, txt, html, epub |

### Spreadsheet

| Target Format | Supported Input Formats |
|--------------|------------------------|
| xlsx | pdf, xls, ods, csv, html |
| xls | pdf, xlsx, ods, csv |
| ods | pdf, xlsx, xls, csv |

### Presentation

| Target Format | Supported Input Formats |
|--------------|------------------------|
| pptx | pdf, ppt, odp, html, png, jpg |
| ppt | pdf, pptx, odp |
| odp | pdf, pptx, ppt |

### Text & Web

| Target Format | Supported Input Formats |
|--------------|------------------------|
| txt | pdf, odt, docx |
| html | pdf, docx, odt |

## Installation

<b>1. Clone this repository</b>
```bash
git clone https://github.com/Kreo141/Basic-Tools.git
```

<b>2. Go to the Basic-Tools directory</b>
```bash
cd Basic-Tools
```

<b>3. Build docker compose</b>
```bash
docker compose build
```
if you want it to start after building:
```bash
docker compose up --build
```

## How to use it
- Acess the website
<a href="asdasd">http://localhost:5001/</a>
<br>
or
<br>
<a href="asdasd">http://{server-local-ip-address}:5001/</a>

## Additional Tips
- Restart automatically except when you manually stop it
```docker
services:
  server:
    build: ./server
    ports:
      - "5001:5001"
    restart: unless-stopped
```

## Built With
- [React](https://react.dev/) - Frontend framework
- [Express](https://expressjs.com/) - Backend server framework
- [FFmpeg](https://ffmpeg.org/) - <b>Audio and Video</b> converter
- [ImageMagick](https://imagemagick.org/) - <b>Image</b> converter
- [LibreOffice](https://www.libreoffice.org/) - <b>Document</b> converter
