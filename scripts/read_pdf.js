const fs = require('fs');

async function extract() {
    const pdf = require('pdf-parse');
    let dataBuffer = fs.readFileSync('BLOBZ_IO_v2_GDD.md.pdf');
    try {
        const data = await pdf(dataBuffer);
        fs.writeFileSync('gdd_parsed.md', data.text);
        console.log('PDF parsed successfully to gdd_parsed.md using default export');
    } catch (e) {
        if (pdf.PDFParse) {
             const data = await pdf.PDFParse(dataBuffer);
             fs.writeFileSync('gdd_parsed.md', data.text);
             console.log('PDF parsed successfully to gdd_parsed.md using PDFParse');
        } else {
             console.error("Failed", e);
        }
    }
}
extract();
