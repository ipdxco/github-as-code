Put `github/*.yml` transform rules that you want executed during `Fix` workflow runs here.

*Example*
```ts
import 'reflect-metadata'
import {protectDefaultBranches} from '../shared/protect-default-branches'

protectDefaultBranches()
```
