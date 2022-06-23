import fs from 'fs';
import YAML from 'yaml';

export class Config {
  constructor(organization) {
    this.config = YAML.parseDocument(fs.readFileSync(`${process.cwd()}/../github/${organization}.yml`, 'utf8'));
    this.updatePaths()
  }

  updatePaths() {
    const items = [this.config];
    while (items.length != 0) {
      const item = items.pop();
      if (item.contents?.items || item.value?.items) {
        (item.contents?.items || item.value?.items).forEach(child => {
          child.path = [...(item.path || []), child.key?.value || child.value]
          items.push(child);
        });
      }
    }
  }

  find(path) {
    return path.reduce((items, pathElement) => {
      return items
        .flatMap(item => {
          return item.value?.items || item;
        })
        .filter(item => {
          return (item.key?.value || item.value).match(new RegExp(`^${typeof pathElement == 'object' ? Object.keys(pathElement)[0] : pathElement}$`));
        });
    }, [{value: this.config.contents}]);
  }

  add(path) {
    for (const [index, pathElement] of Object.entries(path)) {
      const intIndex = parseInt(index);
      if (! this.has(path.slice(0, intIndex + 1))) {
        const parent = this.find(path.slice(0, intIndex))[0];
        if (intIndex + 1 == path.length) {
          if (YAML.isNode(pathElement) || YAML.isPair(pathElement)) {
            parent.value.items.push(pathElement);
          } else if (typeof pathElement == 'object') {
            parent.value.items.push(YAML.parseDocument(YAML.stringify(pathElement)).contents.items[0]);
          } else {
            parent.value.items.push(YAML.parseDocument(YAML.stringify(pathElement)).contents);
          }
        } else if (intIndex + 2 == path.length) {
          const nextPathElement = path[intIndex + 1];
          if (YAML.isPair(nextPathElement) || ((! YAML.isNode(nextPathElement)) && typeof nextPathElement == 'object')) {
            parent.value.items.push(YAML.parseDocument(YAML.stringify({ [pathElement]: {}})).contents.items[0]);
          } else {
            parent.value.items.push(YAML.parseDocument(YAML.stringify({ [pathElement]: []})).contents.items[0]);
          }
        } else {
          parent.value.items.push(YAML.parseDocument(YAML.stringify({ [pathElement]: {}})).contents.items[0]);
        }
      }
    }
  }

  delete(resource) {
    const parent = this.find(resource.path.slice(0, -1))[0];
    parent.value.items = parent.value.items.filter(child => {
      return child !== resource;
    });
  }

  move(resource, path) {
    this.add([...path.slice(0, -1), resource]);
    this.delete(resource);
  }

  toString() {
    //console.debug(JSON.stringify(this.config, null, 2));
    return this.config.toString({ collectionStyle: 'block' });
  }

  has(path) {
    return this.find(path).length != 0;
  }

  update(path) {
    const resource = this.find(path)[0].value;
    if (YAML.isMap(resource)) {
      Object.entries(Object.values(path[path.length-1])[0]).forEach(([key, value]) => {
        const item = resource.items.find(item => {
          return item.key.value == key;
        });
        if (item) {
          item.value = YAML.parseDocument(YAML.stringify(value)).contents;
        } else {
          resource.items.push(YAML.parseDocument(YAML.stringify({ [key]: value })).contents.items[0])
        }
      });
    }
  }

  ignore(path, keys) {
    const resource = this.find(path)[0].value;
    if (YAML.isMap(resource)) {
      resource.items = resource.items.filter(item => {
        return ! keys.includes(item.key.value);
      }).filter(item => {
        return ! (YAML.isScalar(item.value) && item.value.value == null);
      });
    }
  }
}
