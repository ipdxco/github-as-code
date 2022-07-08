import * as fs from 'fs'
import * as path from 'path'

export const env = {
  TF_EXEC: process.env.TF_EXEC || true,
  TF_LOCK: process.env.TF_LOCK || true,
  TF_WORKING_DIR: '../terraform',
  FILES_DIR: '../files',
  GITHUB_DIR: '../github',
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID || '',
  GITHUB_APP_PEM_FILE: process.env.GITHUB_APP_PEM_FILE || '',
  GITHUB_ORG: process.env.TF_WORKSPACE || 'default'
}

export function camelCaseToSnakeCase(str: string): string {
  return `${str.charAt(0).toLowerCase()}${str
    .slice(1)
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()}`
}

export function findFileByContent(
  dirPath: string,
  content: string
): string | undefined {
  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const fileStats = fs.lstatSync(filePath)
    if (fileStats.isFile()) {
      const fileContent = fs.readFileSync(filePath).toString()
      if (fileContent === content) {
        return filePath
      }
    } else if (fileStats.isDirectory()) {
      const otherFilePath = findFileByContent(filePath, content)
      if (otherFilePath) {
        return otherFilePath
      }
    }
  }
  return undefined
}
