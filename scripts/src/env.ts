export default {
  TF_EXEC: process.env.TF_EXEC || 'true',
  TF_LOCK: process.env.TF_LOCK || 'true',
  TF_WORKING_DIR: process.env.TF_WORKING_DIR || '../terraform',
  FILES_DIR: process.env.FILES_DIR || '../files',
  GITHUB_DIR: process.env.GITHUB_DIR || '../github',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
  GITHUB_APP_INSTALLATION_ID: process.env.GITHUB_APP_INSTALLATION_ID || '',
  GITHUB_APP_PEM_FILE: process.env.GITHUB_APP_PEM_FILE || '',
  GITHUB_ORG: process.env.TF_WORKSPACE || 'default'
}
