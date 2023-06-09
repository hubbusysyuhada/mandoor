import { EnvObj } from "@/components/env";
import { Column, Schema, Table } from "@/components/schema";
import { RequestBody } from "@/pages/api/generate";
import fs from 'fs'
import { zip } from 'zip-a-folder';
import _ from 'lodash'
import ColumnGenerator from "./columnGenerator";
import path from "path";
import { FKActionType } from "@/components/column/relation";

export default class ServerGenerator {
  protected env: EnvObj[]
  protected schema: Schema
  // protected dirr = 'mandoor-generated-server'
  // protected zipPath = 'mandoor-generated-server.zip'
  protected dirr = '/tmp/mandoor-generated-server'
  protected zipPath = '/tmp/mandoor-generated-server.zip'
  protected templatePath = path.join(process.cwd(), 'template')

  constructor(body: RequestBody) {
    this.env = body.env
    this.schema = body.schema
  }

  public async generateServer() {
    await this.makeDirectory()
    await this.generateEnv()

    await this.generateRootFiles()
    await this.generateTypes()
    await this.generateMiddlewares()
    await this.generateDatabaseEntity()
    await this.generateHandler()
    await this.generateRoutes()

    await this.compileFile()
  }

  protected async generateHandler() {
    this.makeDirectory(`${this.dirr}/handlers`)
    const tables = this.schema.tables.filter(t => t.name !== 'user')
    const userTemplates = fs.readFileSync(this.templatePath + '/handlers/UserHandler.ts.txt', { encoding: "utf-8" })
    const template = fs.readFileSync(this.templatePath + '/handlers/ModelHandler.ts.txt', { encoding: "utf-8" })
    fs.writeFileSync(`${this.dirr}/handlers/UserHandler.ts`, userTemplates)

    tables.forEach(async (t) => {
      const id = t.columns.find(c => c.name === 'id') as Column
      const ID_TYPE = await new ColumnGenerator(id)[id.type](true)

      const MODEL = _.upperFirst(_.camelCase(t.name))
      fs.writeFileSync(`${this.dirr}/handlers/${MODEL}Handler.ts`, this.parseFileContent({ MODEL, ID_TYPE }, template), { encoding: 'utf-8' })
    })
  }

  protected async generateRoutes() {
    this.makeDirectory(`${this.dirr}/routes`)
    const tables = this.schema.tables.filter(t => t.name !== 'user').map(v => v.name)
    const userTemplates = fs.readFileSync(this.templatePath + '/routes/userRoute.ts.txt', { encoding: "utf-8" })
    const indexTemplate = fs.readFileSync(this.templatePath + '/routes/index.ts.txt', { encoding: "utf-8" })
    const template = fs.readFileSync(this.templatePath + '/routes/modelRoute.ts.txt', { encoding: "utf-8" })
    fs.writeFileSync(`${this.dirr}/routes/userRoute.ts`, userTemplates)

    const imports: string[] = []
    const routeRegister: string[] = [`server.register(userRoute)`]

    tables.forEach(t => {
      const name = _.camelCase(t)
      imports.push(`import ${name}Route from "./${name}Route";`)
      routeRegister.push(`  server.register(${name}Route, {prefix: '${t}'})`)
      const params = {
        MODEL_HANDLER: `${_.upperFirst(name)}Handler`,
        ROUTE_NAME: `${name}Route`,
      }
      fs.writeFileSync(`${this.dirr}/routes/${name}Route.ts`, this.parseFileContent(params, template), { encoding: 'utf-8' })
    })
    const IMPORTED_ROUTES = imports.join('\n')
    const ROUTES = routeRegister.join('\n')
    fs.writeFileSync(`${this.dirr}/routes/index.ts`, this.parseFileContent({ IMPORTED_ROUTES, ROUTES }, indexTemplate), { encoding: 'utf-8' })
  }

  protected async generateTypes() {
    const userColumns = this.schema.tables[0].columns
    const columnType = {
      "varchar": "string",
      "tinytext": "string",
      "mediumtext": "string",
      "longtext": "string",
      "password": "string",
      "integer": "number",
      "float": "number",
      "boolean": "boolean",
      "timestamp": "Date",
      "uuid": "string",
      "autoincrement": "number",
      "relation": "string"
    }

    this.makeDirectory(`${this.dirr}/@types`)
    this.makeDirectory(`${this.dirr}/@types/fastify`)
    const template = fs.readFileSync(this.templatePath + '/@types/fastify/index.d.ts.txt', { encoding: "utf-8" })
    const USER = `{\n${userColumns.filter(c => !['password', 'relation'].includes(c.type)).map(c => `  ${c.name}: ${columnType[c.type]};\n`).join('')}}`
    fs.writeFileSync(`${this.dirr}/@types/fastify/index.d.ts`, this.parseFileContent({ USER }, template))
  }

  protected async generateMiddlewares() {
    this.makeDirectory(`${this.dirr}/middleware`)
    const templates = fs.readdirSync(this.templatePath + '/middleware', { withFileTypes: true })
    templates.forEach(f => {
      const { name } = f
      const file = fs.readFileSync(`${this.templatePath}/middleware/${name}`, { encoding: "utf-8" })
      const path = `${this.dirr}/middleware/${name.slice(0, -4)}`
      fs.writeFileSync(path, file)
    })
  }

  public getFileStream() {
    return fs.createReadStream(this.zipPath)
  }

  protected async generateRootFiles() {
    const templates = fs.readdirSync(this.templatePath, { withFileTypes: true })

    templates.forEach(f => {
      const { name } = f
      if (f.isFile()) {
        const file = fs.readFileSync(`${this.templatePath}/${name}`, { encoding: "utf-8" })
        const path = `${this.dirr}/${name.slice(0, -4)}`
        fs.writeFileSync(path, file)
      }
    })
    const jsonFile = { schema: this.schema, env: this.env.map(({ key }) => ({ key, value: "" })) }
    fs.writeFileSync(`${this.dirr}/schema-metadata.json`, JSON.stringify(jsonFile, null, 2), { "encoding": "utf-8" })
  }

  protected async generateDatabaseEntity() {
    this.makeDirectory(`${this.dirr}/database`)
    for (const table of this.schema.tables) {
      await this.generateModelEntities(table)
    }
    let IMPORT = ''
    let DRIVER = ''
    switch (this.env.find(e => e.key === 'DB_TYPE')?.value) {
      case 'mariadb':
        DRIVER = 'MariaDbDriver'
        IMPORT = `import { ${DRIVER} } from "@mikro-orm/mariadb";`
        break;
      case 'mongo':
        DRIVER = 'MongoDriver'
        IMPORT = `import { ${DRIVER} } from "@mikro-orm/mongodb";`
        break;
      case 'mysql':
        DRIVER = 'MySqlDriver'
        IMPORT = `import { ${DRIVER} } from "@mikro-orm/mysql";`
        break;
      case 'postgresql':
        DRIVER = 'PostgreSqlDriver'
        IMPORT = `import { ${DRIVER} } from "@mikro-orm/postgresql";`
        break;
      case 'sqlite':
      default:
        DRIVER = 'SqliteDriver'
        IMPORT = `import { ${DRIVER} } from "@mikro-orm/sqlite";`
        break;
    }

    const template = fs.readFileSync(`${this.templatePath}/database/index.ts.txt`, { encoding: "utf-8" })

    fs.writeFileSync(`${this.dirr}/database/index.ts`, this.parseFileContent({ IMPORT, DRIVER }, template), { encoding: 'utf-8' })
  }

  protected parseFileContent(arg: Record<string, string>, fileContent: string) {
    for (const key in arg) {
      const regex = new RegExp(`{{!! ${key} !!}}`, 'g')
      fileContent = fileContent.replace(regex, arg[key])
    }
    return fileContent
  }

  protected async generateModelEntities(table: Table) {
    this.makeDirectory(`${this.dirr}/database/entity`)
    const template = fs.readFileSync(`${this.templatePath}/database/entity/entity.ts.txt`, { encoding: "utf-8" })
    const TABLENAME = table.name
    const CLASSNAME = _.upperFirst(_.camelCase(table.name))

    const relationTables: string[] = []
    const relationColumns: string[] = []

    const COLUMN = (await Promise.all(table.columns.map(async column => {
      if (column.type === 'relation') {
        relationColumns.push(column.name)
        const targetTable = _.upperFirst(_.camelCase(this.schema.tables[column.relation?.targetTable as number].name))
        if (!relationTables.includes(targetTable)) relationTables.push(targetTable)
      }
      return await new ColumnGenerator(column)[column.type](false, { tableName: table.name, tables: this.schema.tables })
    }))).join('\n\n')
    const RELATION_COLUMNS = `[${relationColumns.map(c => `'${c}'`)}]`
    
    const IMPORT_RELATION = relationTables.map(v => `import ${v} from './${v}';`).join('\n')

    fs.writeFileSync(`${this.dirr}/database/entity/${CLASSNAME}.ts`, this.parseFileContent({ TABLENAME, CLASSNAME, COLUMN, IMPORT_RELATION, RELATION_COLUMNS }, template), { encoding: 'utf-8' })
  }

  protected async makeDirectory(dir?: string) {
    if (!fs.existsSync(dir || this.dirr)) {
      fs.mkdirSync(dir || this.dirr)
    }
  }

  public async deleteDirectory() {
    if (fs.existsSync(this.dirr)) {
      fs.rmSync(this.dirr, { recursive: true, force: true });
    }
  }

  protected async generateEnv() {
    this.makeDirectory(`${this.dirr}/helpers`)
    let envExample = ''
    let envServer = ''
    let envHelper: string[] = ['']

    const template = fs.readFileSync(this.templatePath + '/helpers/env.ts.txt', { encoding: "utf-8" })

    this.env.forEach(({ key, value }) => {
      envExample += `${key}=\n`
      envServer += `${key}=${value}\n`
      envHelper.push(`  ${key}: process.env.${key},`)
    })
    const ENV = envHelper.join('\n') + '\n'

    fs.writeFileSync(`${this.dirr}/.env.example`, envExample, { encoding: 'utf-8' })
    fs.writeFileSync(`${this.dirr}/.env`, envServer, { encoding: 'utf-8' })
    fs.writeFileSync(`${this.dirr}/helpers/env.ts`, this.parseFileContent({ ENV }, template), { encoding: 'utf-8' })
  }

  protected async compileFile() {
    await zip(this.dirr, this.zipPath)
  }
}