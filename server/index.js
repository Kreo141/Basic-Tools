require('./jobs/cleanupConverts')

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

const isDev = true

const libreofficeLocation = isDev ? "C:/Program Files/LibreOffice/program/" : ""
const sofficeCmd = isDev ? "soffice.com" : "soffice"
const magickCmd = isDev ? "magick" : "convert"
if(isDev){
    ffmpeg.setFfmpegPath('E:/DevEnv/Projects/MajorProjects/Basic-Tools/ffmpeg-2026-05-13-git-a327bc0561-essentials_build/bin/ffmpeg.exe')
}

const uploadDir = './uploads/toConvert';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/toConvert')
    },

    filename: (req, file, cb) => {
        const uniqueName = Date.now() + path.extname(file.originalname)

        cb(null, uniqueName)
    }
})

const upload = multer({ storage });


//* Init Important Variables
const conversionTask = {}

//* Uploading Routes
app.post('/convert/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("File received:", req.file);

    const newConvertKey = crypto.randomBytes(32).toString('hex');

    conversionTask[newConvertKey] = {fileID: req.file.filename, convertedFileID: null, progress: 0}

    res.json({
        message: "File received for conversion",
        convertKey: newConvertKey,
        originalName: req.file.originalname,
    });
})


//* Conversion Routes
const presets = {
    mp4: {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        options: ['-movflags +faststart']
    },

    webm: {
        videoCodec: 'libvpx-vp9',
        audioCodec: 'libopus'
    },

    avi: {
        videoCodec: 'mpeg4',
        audioCodec: 'libmp3lame'
    },

    mkv: {
        videoCodec: 'libx264',
        audioCodec: 'aac'
    },

    defaultPreset: {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        options: [
            '-crf 23',
            '-preset medium',
            '-pix_fmt yuv420p', 
            '-movflags +faststart'
        ]
    }
}

// TODO: Preserving video quality when converting
app.post('/convert/Video', (req, res) => {
    console.log('Video Conversion Request')

    const { convertKey, originalFormat, toConvertTo, OwnerKey } = req.body

    const fileID = conversionTask[convertKey].fileID
    console.log(fileID)
    const preset = presets[toConvertTo] || presets.defaultPreset

    console.log(req.body)

    ffmpeg()
        .input(`uploads/toConvert/${fileID}`)
        .inputFormat(originalFormat)
        .output(`uploads/converted/${fileID}.${toConvertTo}`)
        .videoCodec(preset.videoCodec)
        .audioCodec(preset.audioCodec)
        .outputOptions(preset.options || [])
        .on('start', commandLine => {
            console.log('FFmpeg started:', commandLine)
        })
        .on('progress', progress => {
            console.log(progress)
            conversionTask[convertKey].progress = progress.percent || 0
        })
        .on('end', async () => {
            console.log('Conversion done')

            conversionTask[convertKey].progress = 100
            conversionTask[convertKey].convertedFileID = `${fileID}.${toConvertTo}`

            const rawConvertsData = await fsSync.readFile(convertsJsonPath, 'utf8')

            const convertsJsonObject = JSON.parse(rawConvertsData)

            convertsJsonObject[`${fileID}.${toConvertTo}`] = {
                "OwnerKey": OwnerKey,
                "age": Date.now()
            }

            fs.writeFile(convertsJsonPath, JSON.stringify(convertsJsonObject, null, 2), 'utf8')
            res.json({
                message: "File Converted!",
            })
        })
        .on('error', err => {
            console.log('File conversion error. FFmpeg error')

            res.status(500).json({
                error: err.message
            })
        })
        .run()
})

// TODO: mp3 to amr corrupt
app.post('/convert/Audio', (req, res) => {
    console.log('Audio Conversion Request')

    const { convertKey, originalFormat, toConvertTo, OwnerKey } = req.body

    const fileID = conversionTask[convertKey].fileID
    console.log(fileID)

    ffmpeg()
        .input(`uploads/toConvert/${fileID}`)
        .inputFormat(originalFormat)
        .output(`uploads/converted/${fileID}.${toConvertTo}`)
        .on('start', commandLine => {
            console.log('FFmpeg started:', commandLine)
        })
        .on('progress', progress => {
            console.log(progress)

            conversionTask[convertKey].progress = progress.percent || 0
        })
        .on('end', async () => {
            console.log('Conversion done')
            conversionTask[convertKey].progress = 100
            conversionTask[convertKey].convertedFileID = `${fileID}.${toConvertTo}`

            const rawConvertsData = await fsSync.readFile(convertsJsonPath, 'utf8')

            const convertsJsonObject = JSON.parse(rawConvertsData)

            convertsJsonObject[`${fileID}.${toConvertTo}`] = {
                "OwnerKey": OwnerKey,
                "age": Date.now()
            }

            fsSync.writeFile(convertsJsonPath, JSON.stringify(convertsJsonObject, null, 2), 'utf8')
            res.json({
                message: "File Converted!",
            })
        })
        .on('error', err => {
            console.log('File conversion error. FFmpeg error')

            res.status(500).json({
                error: err.message
            })
        })
        .run()
})

app.post('/convert/Image', (req, res) => {
    console.log("Image Conversion Request")
    const { convertKey, toConvertTo } = req.body
    const fileID = conversionTask[convertKey].fileID
    exec(
        `${magickCmd} "./uploads/toConvert/${fileID}" "./uploads/converted/${fileID}.${toConvertTo}"`,
        (error) => {
            if(error){
                console.log(error)
                return res.status(500).json({
                    error: error.message
                })
            }

            conversionTask[convertKey].progress = 100
            conversionTask[convertKey].convertedFileID = `${fileID}.${toConvertTo}`
            res.json({
                message: "File Converted"
            })
        }
    )
})

app.post('/convert/Document', (req, res) => {
    console.log("Document Conversion Request")
    const { convertKey, toConvertTo} = req.body
    const fileID = conversionTask[convertKey].fileID

    exec(
        `"${libreofficeLocation}${sofficeCmd}" --headless --convert-to ${toConvertTo} --outdir ./uploads/converted/ ./uploads/toConvert/${fileID} `,
        (error) => {
            if(error){
                console.log(error.message)
                return res.status(500).json({
                    message: error.message
                })
            }

            const slice = fileID.split('.')
            const newFileName = `${slice[0]}.${toConvertTo}`
            
            conversionTask[convertKey].progress = 100
            conversionTask[convertKey].convertedFileID = `${newFileName}`
            res.json({
                message: "File Converted!"
            })
        }
    )
})

//* Polling
app.get('/convert/progress/:convertKey', (req, res) => {
    const fileID = conversionTask[req.params.convertKey].convertedFileID

    res.json({
        progress: conversionTask[req.params.convertKey].progress ? conversionTask[req.params.convertKey].progress : -1
    })
})

app.use(express.static(path.join(__dirname, 'public')))

app.get((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

//* Download Converted File
app.get('/convert/download/:convertKey', (req, res) => {
    const filePath = `./uploads/converted/${conversionTask[req.params.convertKey].convertedFileID}`
    console.log(filePath)
    console.log(req.params.convertKey)

    if(!filePath || !conversionTask[req.params.convertKey]){
        return res.status(404).json({
            message: "Converted file not found",
            key: req.params.convertKey
        })
    }

    res.download(filePath, (err) => {
        if(err){
            console.log(err)
            res.status.send('File download failed')
        }   
    })
})

app.get('/convert/deleteOriginalFile/:convertKey', (req, res) => {
    fs.unlink(`./uploads/toConvert/${conversionTask[req.params.convertKey].fileID }`, (err) => {
        if(err){
            console.log("Failed to delete original file: ", err)
            return
        }

        console.log("Original File Deleted")
    })
})

const PORT = appConfig.PORT

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on 0.0.0.0:${PORT}`)
})