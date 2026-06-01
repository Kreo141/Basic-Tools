import conversionTypes from "./configs/conversionTypes.json" with { type: "json"}

const getSupportedFormatsRaw = (fileType) => {
    const fileSupportedFormatsRaw = conversionTypes.find(
        (item) => item.name = fileType
    ).supportedFormat

    return fileSupportedFormatsRaw
}

const getSupportedFormats = (fileType) => Object.keys(getSupportedFormatsRaw(fileType))

console.log(getSupportedFormatsRaw("Image"))