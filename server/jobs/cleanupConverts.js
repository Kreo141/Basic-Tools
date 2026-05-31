const fsSync = require('fs/promises')
const path = require('path')

const convertsJsonPath = path.resolve(__dirname, "../data/converts.json")
const convertedFilePath = path.resolve(__dirname, "../uploads/converted/")

const oneHour = 60 * 60 * 1000

let hasChanges = false
let deleteFilename = null
let intervalRunning = false

const interval = setInterval(async () => {
    if(intervalRunning) return
    intervalRunning = true
    try{
        const convertsRaw = await fsSync.readFile(convertsJsonPath, 'utf8')
        const convertsJsonObject = JSON.parse(convertsRaw)

        const filenames = Object.keys(convertsJsonObject)
        
        filenames.forEach(filename => {
            if(Date.now() - convertsJsonObject[filename].age > oneHour){
                console.log("File Deleted")
                delete convertsJsonObject[filename]
                deleteFilename = filename
                fsSync.unlink(path.join(convertedFilePath, deleteFilename))
                hasChanges = true
            }

            if(hasChanges){
                fsSync.writeFile(convertsJsonPath, JSON.stringify(convertsJsonObject, null, 2))
            }
        });
    }catch(error){
        console.log(error)
        clearInterval(interval)
    } finally {
        intervalRunning = false
    }
}, 1000)