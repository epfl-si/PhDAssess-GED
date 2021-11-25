/*
 * Here you can manually test the GED deposit.
 * Please set the correctly .env, you don't want to send test data on production
 */
require('dotenv').config()

import {getStudentFolderURL, getTicket, readFolder, uploadPDF} from "../src/ged-connector";
import 'mocha'

const phdStudentName = process.env.PHDSTUDENTNAME!
const phdStudentSciper = process.env.PHDSUTDENTSCIPER!
const doctoratID = process.env.PHDSTUDENTDOCTORAT!

const pdfFileName = `Rapport annuel doctorat.pdf`
const base64String = process.env.PDFSTRING!
const pdfFile = Buffer.from(base64String, 'base64')

describe('Testing GED deposit', async () => {
  it('should get a ticket', async () => {
    await getTicket(true)
  })

  it('should read the student folder', async () => {
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName, phdStudentSciper, doctoratID)
    await readFolder(alfrescoStudentsFolderURL)
  })

  it('should upload the pdf to the student folder', async () => {
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName, phdStudentSciper, doctoratID)
    await uploadPDF(alfrescoStudentsFolderURL, pdfFileName, pdfFile)
  })
})
