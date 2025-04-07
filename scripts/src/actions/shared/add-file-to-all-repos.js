import { Config } from '../../yaml/config.js';
import { Repository } from '../../resources/repository.js';
import { RepositoryFile } from '../../resources/repository-file.js';
import * as core from '@actions/core';
export async function runAddFileToAllRepos(name, content = name, repositoryFilter = () => true) {
    const config = Config.FromPath();
    await addFileToAllRepos(config, name, content, repositoryFilter);
    config.save();
}
export async function addFileToAllRepos(config, name, content = name, repositoryFilter = () => true) {
    const repositories = config
        .getResources(Repository)
        .filter(r => !r.archived)
        .filter(repositoryFilter);
    for (const repository of repositories) {
        const file = new RepositoryFile(repository.name, name);
        file.content = content;
        if (!config.someResource(file)) {
            core.info(`Adding ${file.file} file to ${file.repository} repository`);
            config.addResource(file);
        }
    }
}
