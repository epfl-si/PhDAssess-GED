// set timeout and retry values

import debug_ from 'debug'
import _ from "lodash"
import got from 'got'
import {Readable} from "stream"
import {URL} from "url";
import {FormData, File} from 'formdata-node'
import {FormDataEncoder} from "form-data-encoder"
import {ecolesDoctorales} from "./doctorats"
import {AlfrescoTicketResponse} from "./alfresco_types"


const debug = debug_('ged-connector')

const alfrescoBaseURL = process.env.ALFRESCO_URL
const alfrescoLoginUrl = new URL(`/alfresco/service/api/login`, alfrescoBaseURL)
const alfrescoRequestTimeoutMS = 40000


let _ticket: string | undefined = undefined

const getTicket = async (): Promise<string | undefined> => {
  if (_ticket) {
    return Promise.resolve(_ticket)
  } else {
    try {
      if (process.env.ALFRESCO_USERNAME && process.env.ALFRESCO_PASSWORD) {
        alfrescoLoginUrl.search = `u=${process.env.ALFRESCO_USERNAME}&pw=${process.env.ALFRESCO_PASSWORD}&format=json`
        const dataTicket: AlfrescoTicketResponse = await got.get(alfrescoLoginUrl, {
          timeout: {
            request: alfrescoRequestTimeoutMS
          },
          retry: {
            limit: 0
          },
        }).json()

        debug(`Asked for the alfresco ticket and got ${_ticket}`)
        return dataTicket.data.ticket
      }
    } catch (e: any) {
      console.error(`Failed: unable to fetch a ticket from Alfresco. ${e.message}`)
      // send the error back to zeebe
      throw e
    }
  }
}

const getStudentFolderURL = (studentName: string, sciper: string, doctoratID: string, ticket: string): URL => {
  const studentFolderName = `${studentName}, ${sciper}`
  const doctoratName = _.find(ecolesDoctorales, {id: doctoratID})?.label ?? doctoratID

  const StudentsFolderURL = new URL(
    `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`,
    alfrescoBaseURL
  )

  StudentsFolderURL.search = `alf_ticket=${ticket}&format=json`

  return StudentsFolderURL
}

export const readFolder = async (studentName: string, sciper: string, doctoratID: string) => {
  const ticket = await getTicket()

  const alfrescoStudentsFolder = getStudentFolderURL(studentName, sciper, doctoratID, ticket!)

  debug(`Will fetch the student folder with url ${alfrescoStudentsFolder}`)
  const studentFolderInfo = await got.get(alfrescoStudentsFolder, {}).json()
  console.log(`Fetched ${JSON.stringify(studentFolderInfo, null, 2)}`)
}

export const uploadPDF = async (studentName: string,
                                sciper: string,
                                doctoratID: string,
                                pdfFileName: string,
                                pdfFile: Buffer) => {
  const ticket = await getTicket()

  const alfrescoStudentsFolder = getStudentFolderURL(studentName, sciper, doctoratID, ticket!)

  debug(`Will post the PDF with url ${alfrescoStudentsFolder}`)

  const form = new FormData()
  form.set('cmisaction', 'createDocument')
  form.set('propertyId[0]', 'cmis:objectTypeId')
  form.set('propertyValue[0]', 'cmis:document')
  form.set('propertyId[1]', 'cmis:name')
  form.set('propertyValue[1]', pdfFileName)
  form.set('succinct', 'true')

  const pdfBlob = new File([pdfFile], pdfFileName)

  form.set('file', pdfBlob)
  const encoder = new FormDataEncoder(form)

  try {
    await got.post(
      alfrescoStudentsFolder,
      {
        body: Readable.from(encoder.encode()),
        headers: encoder.headers,
        timeout: {
          request: alfrescoRequestTimeoutMS
        },
        retry: {
          limit: 0
        },
      }
    )
    console.log(`Succesfully uploaded the ${pdfFileName} for ${studentName} (${sciper}) into ${alfrescoStudentsFolder}`)
  } catch (e: any) {
    console.log(`Unable to send the PDF file. Error was : ${e.message}`)
    // throw the error back to Zeebe
    throw e
  }
}
