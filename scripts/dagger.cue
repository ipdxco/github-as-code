package main

import (
	"dagger.io/dagger"
	"dagger.io/dagger/core"
	"universe.dagger.io/bash"
	"universe.dagger.io/docker"
)

dagger.#Plan & {
	actions: {
		source: core.#Source & {
			path: "."
			exclude: [
				"node_modules",
				"lib",
			]
		}
		test: {
			pull: docker.#Pull & {
				source: "node:lts"
			}
			copy: docker.#Copy & {
				input:    pull.output
				contents: actions.source.output
			}
			install: bash.#Run & {
				input: copy.output
				script: contents: """
					npm install
					"""
			}
			test: bash.#Run & {
				input: install.output
				script: contents: """
					npm run test
					"""
			}
		}
	}
}
