import {cmis} from "cmis/dist/cmis";
import CmisSession = cmis.CmisSession;
import {URL} from "url";


const alfrescoUrl = new URL(`https://integration-gedetu.epfl.ch/alfresco/api/-default-/public/cmis/versions/1.1/browser`)

/*
 * Set the provided config from http://127.0.0.1:8080 to whatever is configured
 */
const fixAlfrescoUrls = (repositoryUrlString: string) => {
  let repositoryUrl = new URL(repositoryUrlString)
  repositoryUrl.protocol = alfrescoUrl.protocol
  repositoryUrl.hostname = alfrescoUrl.hostname
  return repositoryUrl.toString()
}

export const getAlfrescoInfo = async () => {
  if (process.env.ALFRESCO_USERNAME && process.env.ALFRESCO_PASSWORD) {
    let session = new CmisSession(alfrescoUrl.toString());
    await session.setCredentials(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD).loadRepositories()

    // force settings the urls, as it looks to me wrongly configured ?
    session.defaultRepository.repositoryUrl = fixAlfrescoUrls(session.defaultRepository.repositoryUrl)
    session.defaultRepository.rootFolderUrl = `${fixAlfrescoUrls(session.defaultRepository.rootFolderUrl)}`

    //console.log(session.defaultRepository)
    //console.log(session.repositories)


    const data = await session.getRepositoryInfo()
    console.log(data)

    //const data = await session.query("select * from cmis:document limit 1")

  }
}
