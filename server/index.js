const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const fsSync = require('fs/promises')
const multer = require('multer')
const ffmpeg = require('fluent-ffmpeg')
const { exec } = require('child_process')
const crypto = require('crypto')
const appConfig = require('./configs/app.json')

const app = express()
app.use(cors())
app.use(express.json())

const convertsJsonPath = path.resolve(__dirname, './data/converts.json')

//  Init data file
if (!fs.existsSync(convertsJsonPath)) {
    console.log('Creating file:', convertsJsonPath)
    fs.writeFileSync(convertsJsonPath, '{}')
}

require('./jobs/cleanupConverts')

//  Environment config 
const isDev = true

const libreofficeLocation = isDev ? 'C:/Program Files/LibreOffice/program/' : ''
const sofficeCmd          = isDev ? 'soffice.com' : 'soffice'
const magickCmd           = isDev ? 'magick'      : 'convert'

if (isDev) {
    ffmpeg.setFfmpegPath(
        'E:/DevEnv/Projects/MajorProjects/Basic-Tools/ffmpeg-2026-05-13-git-a327bc0561-essentials_build/bin/ffmpeg.exe'
    )
}

// ── Upload directories ────────────────────────────────────────────────────────
const uploadDir    = './uploads/toConvert'
const convertedDir = './uploads/converted'

for (const dir of [uploadDir, convertedDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Store with a UUID filename on disk to avoid any name collisions
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename:    (_req, file,  cb) => {
        const ext      = path.extname(file.originalname)   // e.g. ".mp4"
        const uuidName = crypto.randomUUID() + ext         // e.g. "a1b2-....mp4"
        cb(null, uuidName)
    }
})

const upload = multer({ storage })


// ── In-memory task store ──────────────────────────────────────────────────────
const conversionTask = {}


// ════════════════════════════════════════════════════════════════════════════════
//  VIDEO CODEC PRESETS
//  Each key is the *output* format.
//  videoCodec / audioCodec / outputOptions are passed straight to fluent-ffmpeg.
// ════════════════════════════════════════════════════════════════════════════════
const videoPresets = {
    mp4: {
        videoCodec:    'libx264',
        audioCodec:    'aac',
        outputOptions: ['-crf 23', '-preset medium', '-pix_fmt yuv420p', '-movflags +faststart']
    },
    mov: {
        videoCodec:    'libx264',
        audioCodec:    'aac',
        outputOptions: ['-crf 23', '-preset medium', '-pix_fmt yuv420p', '-movflags +faststart']
    },
    mkv: {
        videoCodec:    'libx264',
        audioCodec:    'aac',
        outputOptions: ['-crf 23', '-preset medium']
    },
    webm: {
        videoCodec:    'libvpx-vp9',
        audioCodec:    'libopus',
        outputOptions: ['-crf 33', '-b:v 0']
    },
    avi: {
        videoCodec:    'mpeg4',
        audioCodec:    'libmp3lame',
        outputOptions: ['-qscale:v 6']
    },
    flv: {
        videoCodec:    'flv1',
        audioCodec:    'libmp3lame',
        outputOptions: ['-ar 44100']
    },
    wmv: {
        videoCodec:    'wmv2',
        audioCodec:    'wmav2',
        outputOptions: []
    },
    m4v: {
        videoCodec:    'libx264',
        audioCodec:    'aac',
        outputOptions: ['-crf 23', '-preset medium', '-pix_fmt yuv420p', '-movflags +faststart']
    },
    mpg: {
        videoCodec:    'mpeg2video',
        audioCodec:    'mp2',
        outputOptions: ['-qscale:v 4']
    },
    mpeg: {
        videoCodec:    'mpeg2video',
        audioCodec:    'mp2',
        outputOptions: ['-qscale:v 4']
    },
    '3gp': {
        videoCodec:    'h263',
        audioCodec:    'aac',
        outputOptions: ['-vf scale=176:144', '-ar 8000', '-ac 1', '-b:a 12.2k']
    }
}

// ════════════════════════════════════════════════════════════════════════════════
//  AUDIO CODEC PRESETS
//  Each key is the *output* format.
// ════════════════════════════════════════════════════════════════════════════════
const audioPresets = {
    mp3:  { audioCodec: 'libmp3lame',  outputOptions: ['-q:a 2'] },
    wav:  { audioCodec: 'pcm_s16le',   outputOptions: [] },
    ogg:  { audioCodec: 'libvorbis',   outputOptions: ['-q:a 4'] },
    flac: { audioCodec: 'flac',        outputOptions: [] },
    aac:  { audioCodec: 'aac',         outputOptions: ['-b:a 192k'] },
    m4a:  { audioCodec: 'aac',         outputOptions: ['-b:a 192k', '-movflags +faststart'] },
    wma:  { audioCodec: 'wmav2',       outputOptions: ['-b:a 192k'] },
    opus: { audioCodec: 'libopus',     outputOptions: ['-b:a 128k'] },
    amr:  { audioCodec: 'libopencore_amrnb', outputOptions: ['-ar 8000', '-ac 1', '-b:a 12.2k'] }
}

// ════════════════════════════════════════════════════════════════════════════════
//  INPUT FORMAT MAP
//  Some container extensions are not recognised by FFmpeg's auto-detection.
//  Map to the demuxer name FFmpeg actually expects.
// ════════════════════════════════════════════════════════════════════════════════
const inputFormatMap = {
    m4v:   'mp4',
    m4a:   'mp4',
    ts:    'mpegts',
    mts:   'mpegts',
    m2ts:  'mpegts',
    mpg:   'mpeg',
    mpeg:  'mpeg',
    '3gp': '3gp', 
    wma:   'asf',
    wmv:   'asf',
    amr:   'amr'
}

/**
 * Return the demuxer name for a given file extension.
 * Falls back to the raw extension if no explicit mapping exists.
 */
function inputFormat(ext) {
    return inputFormatMap[ext.toLowerCase()] || ext.toLowerCase()
}

/**
 * Persist a completed conversion record to converts.json.
 * originalName  – the display name the user will see / download as
 * serverFilename – the UUID filename actually stored on disk
 */
async function recordConversion(originalName, serverFilename, OwnerKey) {
    const raw  = await fsSync.readFile(convertsJsonPath, 'utf8')
    const data = JSON.parse(raw)
    if (!data[OwnerKey]) data[OwnerKey] = {}

    // Key = friendly display name; value holds the real on-disk UUID name
    data[OwnerKey][originalName] = {
        nameInServer: serverFilename,
        age:          Date.now()
    }

    await fsSync.writeFile(convertsJsonPath, JSON.stringify(data, null, 2), 'utf8')
}


//  Upload
app.post('/convert/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    console.log('File received:', req.file)

    const newConvertKey = crypto.randomBytes(32).toString('hex')
    conversionTask[newConvertKey] = {
        fileID:          req.file.filename,      // UUID name on disk  e.g. "abc123.mp4"
        originalName:    req.file.originalname,  // display name       e.g. "my video.mp4"
        convertedFileID: null,
        progress:        0
    }

    res.json({
        message:      'File received for conversion',
        convertKey:   newConvertKey,
        originalName: req.file.originalname
    })
})


//  Video conversion
app.post('/convert/Video', (req, res) => {
    const { convertKey, originalFormat, toConvertTo, OwnerKey } = req.body
    const task = conversionTask[convertKey]

    if (!task) return res.status(404).json({ error: 'Invalid convertKey' })

    const { fileID, originalName } = task
    const preset = videoPresets[toConvertTo]

    if (!preset) {
        return res.status(400).json({ error: `Unsupported output video format: ${toConvertTo}` })
    }

    // Display name shown to user / used as download filename
    const displayName    = path.basename(originalName, path.extname(originalName)) + '.' + toConvertTo
    // UUID name actually written to disk — no collisions possible
    const serverFilename = crypto.randomUUID() + '.' + toConvertTo
    const inputPath      = path.join(uploadDir, fileID)
    const outputPath     = path.join(convertedDir, serverFilename)
    const srcExt         = path.extname(fileID).replace('.', '')

    ffmpeg()
        .input(inputPath)
        .inputFormat(inputFormat(originalFormat || srcExt))
        .output(outputPath)
        .videoCodec(preset.videoCodec)
        .audioCodec(preset.audioCodec)
        .outputOptions(preset.outputOptions || [])
        .on('start', cmd  => console.log('FFmpeg started:', cmd))
        .on('progress', p => {
            console.log('Progress:', p)
            task.progress = p.percent ?? 0
        })
        .on('end', async () => {
            console.log('Video conversion done')
            task.progress        = 100
            task.convertedFileID = serverFilename

            await recordConversion(displayName, serverFilename, OwnerKey)
            res.json({ message: 'File converted!', converted_filename: displayName })
        })
        .on('error', (err, _stdout, stderr) => {
            console.error('FFmpeg video error:', err.message)
            console.error('FFmpeg stderr:', stderr)
            if (!res.headersSent) res.status(500).json({ error: err.message, detail: stderr })
        })
        .run()
})


//  Audio conversion
app.post('/convert/Audio', (req, res) => {
    const { convertKey, originalFormat, toConvertTo, OwnerKey } = req.body
    const task = conversionTask[convertKey]

    if (!task) return res.status(404).json({ error: 'Invalid convertKey' })

    const { fileID, originalName } = task
    const preset = audioPresets[toConvertTo]

    if (!preset) {
        return res.status(400).json({ error: `Unsupported output audio format: ${toConvertTo}` })
    }

    // Display name shown to user / used as download filename
    const displayName    = path.basename(originalName, path.extname(originalName)) + '.' + toConvertTo
    // UUID name actually written to disk — no collisions possible
    const serverFilename = crypto.randomUUID() + '.' + toConvertTo
    const inputPath      = path.join(uploadDir, fileID)
    const outputPath     = path.join(convertedDir, serverFilename)
    const srcExt         = path.extname(fileID).replace('.', '')

    ffmpeg()
        .input(inputPath)
        .inputFormat(inputFormat(originalFormat || srcExt))
        .output(outputPath)
        .noVideo()
        .audioCodec(preset.audioCodec)
        .outputOptions(preset.outputOptions || [])
        .on('start', cmd  => console.log('FFmpeg started:', cmd))
        .on('progress', p => {
            console.log('Progress:', p)
            task.progress = p.percent ?? 0
        })
        .on('end', async () => {
            console.log('Audio conversion done')
            task.progress        = 100
            task.convertedFileID = serverFilename

            await recordConversion(displayName, serverFilename, OwnerKey)
            res.json({ message: 'File converted!', converted_filename: displayName })
        })
        .on('error', (err, _stdout, stderr) => {
            console.error('FFmpeg audio error:', err.message)
            console.error('FFmpeg stderr:', stderr)
            if (!res.headersSent) res.status(500).json({ error: err.message, detail: stderr })
        })
        .run()
})


//  Image conversion
app.post('/convert/Image', (req, res) => {
    console.log('Image conversion request')

    const { convertKey, toConvertTo, OwnerKey } = req.body
    const task = conversionTask[convertKey]

    if (!task) return res.status(404).json({ error: 'Invalid convertKey' })

    const { fileID, originalName } = task

    // Strip the original extension properly — fixes the double-ext bug (e.g. photo.png.webp)
    const displayName    = path.basename(originalName, path.extname(originalName)) + '.' + toConvertTo
    const serverFilename = crypto.randomUUID() + '.' + toConvertTo
    const inputPath      = path.join(uploadDir, fileID)
    const outputPath     = path.join(convertedDir, serverFilename)

    exec(`${magickCmd} "${inputPath}" "${outputPath}"`, async (error) => {
        if (error) {
            console.error('ImageMagick error:', error)
            return res.status(500).json({ error: error.message })
        }

        task.progress        = 100
        task.convertedFileID = serverFilename

        await recordConversion(displayName, serverFilename, OwnerKey)
        res.json({ message: 'File converted', converted_filename: displayName })
    })
})


//  Document conversion
app.post('/convert/Document', (req, res) => {
    console.log('Document conversion request')

    const { convertKey, toConvertTo, OwnerKey } = req.body
    const task = conversionTask[convertKey]

    if (!task) return res.status(404).json({ error: 'Invalid convertKey' })

    const { fileID, originalName } = task
    const inputPath = path.join(uploadDir, fileID)

    exec(
        `"${libreofficeLocation}${sofficeCmd}" --headless --convert-to ${toConvertTo} --outdir "${convertedDir}" "${inputPath}"`,
        async (error) => {
            if (error) {
                console.error('LibreOffice error:', error.message)
                return res.status(500).json({ message: error.message })
            }

            console.log('Document converted')

            // LibreOffice names its output after the input file (the UUID), so derive that name
            const serverFilename = path.basename(fileID, path.extname(fileID)) + '.' + toConvertTo
            // Friendly name the user sees
            const displayName    = path.basename(originalName, path.extname(originalName)) + '.' + toConvertTo

            task.progress        = 100
            task.convertedFileID = serverFilename

            await recordConversion(displayName, serverFilename, OwnerKey)
            res.json({ message: 'File converted!', converted_filename: displayName })
        }
    )
})


//  Polling
app.get('/convert/progress/:convertKey', (req, res) => {
    const task = conversionTask[req.params.convertKey]

    if (!task) return res.status(404).json({ error: 'Task not found' })

    res.json({ progress: task.progress ?? -1 })

    if (task.progress === 100) {
        setTimeout(() => { delete conversionTask[req.params.convertKey] }, 5 * 60 * 1000)
    }
})


//  Static files
app.use(express.static(path.join(__dirname, 'public')))


//  Delete original after download
app.get('/convert/deleteOriginalFile/:convertKey', (req, res) => {
    const task = conversionTask[req.params.convertKey]
    if (!task) return res.status(404).json({ message: 'Invalid key' })

    fs.unlink(path.join(uploadDir, task.fileID), (err) => {
        if (err) console.error('Failed to delete original file:', err)
        else     console.log('Original file deleted')
    })

    res.json({ message: 'Delete triggered' })
})


// History
app.get('/convert/history/:UserKey', async (req, res) => {
    const { UserKey } = req.params

    const raw  = await fsSync.readFile(convertsJsonPath, 'utf8')
    const data = JSON.parse(raw)

    const userConverts = data[UserKey] ?? {}

    res.json({ success: true, converts: userConverts })
})


// History download
app.get('/convert/download/:UserKey/:filename', async (req, res) => {
    const { UserKey, filename } = req.params   // filename = display name

    console.log('DOWNLOAD:', filename)

    const raw  = await fsSync.readFile(convertsJsonPath, 'utf8')
    const data = JSON.parse(raw)

    if (!data[UserKey])              return res.status(403).json({ success: false, message: 'Invalid key' })
    const record = data[UserKey][filename]
    if (!record)                     return res.status(404).json({ success: false, message: 'File record not found' })

    const filepath = path.join(__dirname, 'uploads', 'converted', record.nameInServer)

    if (!fs.existsSync(filepath))    return res.status(404).json({ success: false, message: 'Converted file not found' })

    // Second arg renames the file for the browser — user gets the friendly display name
    res.download(filepath, filename, (err) => { if (err) console.error(err) })
})


// ===========================================
// CONFIG ROUTES
// ===========================================

// hourExpiry
app.get('/config/hourExpiry/', (req, res) => {
    res.json({
        hourExpiry: appConfig.ExportedFileExpiry
    })
})


// ================== START ==================
const PORT = appConfig.PORT

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`)
})