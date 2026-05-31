const fsSync = require('fs/promises')
const path = require('path')

const convertsJsonPath = path.resolve(__dirname, "../data/converts.json")
const convertedFilePath = path.resolve(__dirname, "../uploads/converted/")

const appConfig = path.resolve(__dirname, '../configs/app.json')

async function start(){
    const appConfigRaw = await fsSync.readFile(appConfig, 'utf8')
    const appConfigJsonObject = JSON.parse(appConfigRaw)

    const hourExpiry = 60 * 60 * appConfigJsonObject.ExportedFileExpiry

    let hasChanges = false
    let intervalRunning = false

    const interval = setInterval(async () => { console.log("Actively Monitoring Expired file/s")
        if(intervalRunning) return
        intervalRunning = true
        try{
            const convertsRaw = await fsSync.readFile(convertsJsonPath, 'utf8')
            const convertsJsonObject = JSON.parse(convertsRaw)

            const filenames = Object.keys(convertsJsonObject)

            //used for of in this because forEach does not wait for async operations
            for(const filename of filenames){
                if(Date.now() - convertsJsonObject[filename].age > hourExpiry){
                    console.log("File Deleted")
                    delete convertsJsonObject[filename]
                    await fsSync.unlink(path.join(convertedFilePath, filename))
                    hasChanges = true
                }
            }

            if(hasChanges){
                await fsSync.writeFile(convertsJsonPath, JSON.stringify(convertsJsonObject, null, 2))
                hasChanges = false
            }
        }catch(error){
            console.log(error)
            clearInterval(interval)
        } finally {
            intervalRunning = false
        }
    }, appConfigJsonObject.GlobalJobInterval)
}

start()