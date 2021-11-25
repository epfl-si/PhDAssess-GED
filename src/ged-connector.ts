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

export const alfrescoBaseURL = process.env.ALFRESCO_URL
const alfrescoLoginUrl = new URL(`/alfresco/service/api/login`, alfrescoBaseURL)
const alfrescoRequestTimeoutMS = 40000  // 40 seconds


let _ticket: string | undefined = undefined

export const getTicket = async (forceNew=false): Promise<string | undefined> => {
  if (!forceNew && _ticket) {
    return Promise.resolve(_ticket)
  } else {
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

      debug(`Asked for the alfresco ticket and got ${JSON.stringify(dataTicket)}`)
      return dataTicket.data.ticket
    }
  }
}

export const getStudentFolderURL = async (studentName: string, sciper: string, doctoratID: string): Promise<URL> => {
  const ticket = await getTicket()
  const studentFolderName = `${studentName}, ${sciper}`
  const doctoratName = _.find(ecolesDoctorales, {id: doctoratID})?.label ?? doctoratID

  const StudentsFolderURL = new URL(
    `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`,
    alfrescoBaseURL
  )

  StudentsFolderURL.search = `alf_ticket=${ticket}&format=json`
  return StudentsFolderURL
}

export const readFolder = async (studentFolder: URL,) => {
  debug(`Will fetch the student folder with url ${studentFolder}`)
  const studentFolderInfo = await got.get(studentFolder, {}).json()
  debug(`Fetched ${JSON.stringify(studentFolderInfo, null, 2)}`)
}

export const uploadPDF = async (studentFolder: URL,
                                pdfFileName: string,
                                pdfFile: Buffer) => {

  debug(`Will post the PDF with url ${studentFolder}`)

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

  await got.post(
    studentFolder,
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

}
