/*
 * Here you can manually test the GED deposit.
 * Please set the correctly .env, you don't want to send test data on production
 */
require('dotenv').config()

import {readFolder, uploadPDF} from "../src/ged-connector";
import 'mocha'

const phdStudentName = process.env.PHDSTUDENTNAME!
const phdStudentSciper = process.env.PHDSUTDENTSCIPER!
const doctoratID = process.env.PHDSTUDENTDOCTORAT!

const pdfFileName = `Rapport annuel doctorat.pdf`
const base64String = process.env.PDFSTRING!
const pdfFile = Buffer.from(base64String, 'base64')

describe('Testing GED deposit', () => {
  it('should read the student folder', async () => {
    await readFolder(phdStudentName, phdStudentSciper, doctoratID)
  })

  it('should upload the pdf to the student folder', async () => {
    await uploadPDF(phdStudentName, phdStudentSciper, doctoratID, pdfFileName, pdfFile)
  })
})
