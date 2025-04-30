/*
 * Here you can manually test the GED deposit.
 * Please set the correctly .env, you don't want to send test data on production
 */
require('dotenv').config()

import {getStudentFolderURL, fetchTicket, readFolder, uploadPDF} from "../src/ged-connector";
import 'mocha'

const chai = require('chai')
const expect = chai.expect

const phdStudentName = process.env.PHDSTUDENTNAME!
const phdStudentSciper = process.env.PHDSTUDENTSCIPER!
const doctoratID = process.env.PHDSTUDENTDOCTORAT!

const pdfFileName = `Rapport annuel doctorat.pdf`
const base64String = process.env.PDFSTRING!
const pdfFile = Buffer.from(base64String, 'base64')

describe('Testing GED deposit', async () => {
  it('should get a ticket', async () => {
    const ticket = await fetchTicket()
    expect(ticket).to.not.be.empty
  })

  it('should read the student folder', async () => {
    const ticket = await fetchTicket()
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
        phdStudentSciper,
        doctoratID,
        ticket
    )
    await readFolder(alfrescoStudentsFolderURL)
  })

  it('should upload the pdf to the student folder', async () => {
    const ticket = await fetchTicket()
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
        phdStudentSciper,
        doctoratID,
        ticket
    )
    await uploadPDF(alfrescoStudentsFolderURL, pdfFileName, pdfFile)
  })
})
