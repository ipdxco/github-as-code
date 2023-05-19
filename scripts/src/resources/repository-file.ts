import {Exclude, Expose, plainToClassFromExist} from 'class-transformer'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'
import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'
import env from '../env'
import * as fs from 'fs'
import * as path from 'path'

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

@Exclude()
export class RepositoryFile implements Resource {
  static StateType: string = 'github_repository_file'
  static async FromGitHub(
    files: RepositoryFile[]
  ): Promise<[Id, RepositoryFile][]> {
    const github = await GitHub.getGitHub()
    const result: [Id, RepositoryFile][] = []
    for (const file of files) {
      const remoteFile = await github.getRepositoryFile(
        file.repository,
        file.file
      )
      if (remoteFile !== undefined) {
        result.push([`${file.repository}/${file.file}:${remoteFile.ref}`, file])
      }
    }
    return result
  }
  static FromState(state: StateSchema): RepositoryFile[] {
    const files: RepositoryFile[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryFile.StateType &&
          resource.mode === 'managed'
        ) {
          const content =
            findFileByContent(env.FILES_DIR, resource.values.content)?.slice(
              env.FILES_DIR.length + 1
            ) || resource.values.content
          files.push(
            plainToClassFromExist(
              new RepositoryFile(
                resource.values.repository,
                resource.values.file
              ),
              {...resource.values, content}
            )
          )
        }
      }
    }
    return files
  }
  static FromConfig(config: ConfigSchema): RepositoryFile[] {
    const files: RepositoryFile[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.files !== undefined) {
          for (const [file_name, file] of Object.entries(repository.files)) {
            files.push(
              plainToClassFromExist(
                new RepositoryFile(repository_name, file_name),
                file
              )
            )
          }
        }
      }
    }
    return files
  }

  constructor(repository: string, name: string) {
    this._repository = repository
    this._file = name
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }
  private _file: string
  get file(): string {
    return this._file
  }

  @Expose() content?: string
  @Expose() overwrite_on_create?: boolean

  getSchemaPath(_schema: ConfigSchema): Path {
    return new Path('repositories', this.repository, 'files', this.file)
  }

  getStateAddress(): string {
    return `${RepositoryFile.StateType}.this["${this.repository}/${this.file}"]`
  }
}
