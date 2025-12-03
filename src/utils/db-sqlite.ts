import initSqlJs from 'sql.js'
import fs from 'node:fs/promises'
import path from 'node:path'

type Doc = Record<string, any>

const DB_PATH = path.resolve('.cache/koishi-registry.sqlite')
let SQLPromise: Promise<any> | null = null
let db: any = null

async function init() {
  if (db) return
  if (!SQLPromise) {
    SQLPromise = initSqlJs({
      locateFile: (file: string) =>
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
    })
  }
  const SQL = await SQLPromise
  try {
    const buf = await fs.readFile(DB_PATH)
    db = new SQL.Database(new Uint8Array(buf))
  } catch {
    db = new SQL.Database()
  }
  db.exec(
    'CREATE TABLE IF NOT EXISTS plugins (package_name TEXT PRIMARY KEY, package_version TEXT, data TEXT)'
  )
  db.exec(
    'CREATE TABLE IF NOT EXISTS system_settings (id TEXT PRIMARY KEY, data TEXT)'
  )
}

class SqliteCollection {
  name: string
  constructor(name: string) {
    // 延迟到各方法中确保初始化
    this.name = name
  }

  find(filter?: Record<string, any>) {
    if (this.name === 'plugins') {
      if (filter && filter['package.name'] && filter['package.name'].$in) {
        const arr = filter['package.name'].$in as string[]
        const rows = db!
          .prepare(
            `SELECT data FROM plugins WHERE package_name IN (${arr
              .map(() => '?')
              .join(',')})`
          )
          .all(...arr)
        const list = rows.map((r: any) => JSON.parse(r.data))
        return { toArray: async () => list }
      }
      const rows = db.exec('SELECT data FROM plugins')
      const list = rows.length
        ? rows[0].values.map((v: any[]) => JSON.parse(String(v[0])))
        : []
      return { toArray: async () => list }
    } else if (this.name === 'system_settings') {
      if (filter && filter._id) {
        const stmt = db.prepare('SELECT data FROM system_settings WHERE id = ?')
        stmt.bind([filter._id])
        const list: any[] = []
        while (stmt.step()) {
          const row = stmt.getAsObject() as any
          list.push(JSON.parse(String(row.data)))
        }
        stmt.free()
        return { toArray: async () => list }
      }
      const rows = db.exec('SELECT data FROM system_settings')
      const list = rows.length
        ? rows[0].values.map((v: any[]) => JSON.parse(String(v[0])))
        : []
      return { toArray: async () => list }
    }
    return { toArray: async () => [] }
  }

  async findOne(filter: Record<string, any>) {
    const arr = await this.find(filter).toArray()
    return arr[0] || null
  }

  async updateOne(
    filter: Record<string, any>,
    update: { $set?: Doc },
    opts?: { upsert?: boolean }
  ) {
    await init()
    if (this.name === 'plugins') {
      const doc = update.$set || {}
      const pkgName = doc?.package?.name
      const pkgVersion = doc?.package?.version || null
      if (!pkgName) return
      const sel = db.prepare('SELECT 1 FROM plugins WHERE package_name = ?')
      sel.bind([pkgName])
      const exists = sel.step()
      sel.free()
      if (exists) {
        const stmt = db.prepare(
          'UPDATE plugins SET package_version = ?, data = ? WHERE package_name = ?'
        )
        stmt.run([pkgVersion, JSON.stringify(doc), pkgName])
        stmt.free()
      } else if (opts?.upsert) {
        const stmt = db.prepare(
          'INSERT INTO plugins (package_name, package_version, data) VALUES (?, ?, ?)'
        )
        stmt.run([pkgName, pkgVersion, JSON.stringify(doc)])
        stmt.free()
      }
      return
    }
    if (this.name === 'system_settings') {
      await init()
      const id = filter._id
      const data = JSON.stringify(update.$set || {})
      const sel = db.prepare('SELECT 1 FROM system_settings WHERE id = ?')
      sel.bind([id])
      const exists = sel.step()
      sel.free()
      if (exists) {
        const stmt = db.prepare(
          'UPDATE system_settings SET data = ? WHERE id = ?'
        )
        stmt.run([data, id])
        stmt.free()
      } else if (opts?.upsert) {
        const stmt = db.prepare(
          'INSERT INTO system_settings (id, data) VALUES (?, ?)'
        )
        stmt.run([id, data])
        stmt.free()
      }
      return
    }
  }

  async bulkWrite(
    ops: Array<{
      updateOne: {
        filter: Record<string, any>
        update: { $set: Doc }
        upsert?: boolean
      }
    }>
  ) {
    await init()
    for (const op of ops) {
      const { filter, update, upsert } = op.updateOne
      await this.updateOne(filter, update, { upsert })
    }
  }

  async deleteMany(filter: Record<string, any>) {
    await init()
    if (this.name === 'plugins') {
      if (filter['package.name'] && filter['package.name'].$in) {
        const arr = filter['package.name'].$in as string[]
        const placeholders = arr.map(() => '?').join(',')
        const stmt = db.prepare(
          `DELETE FROM plugins WHERE package_name IN (${placeholders})`
        )
        stmt.run(arr)
        stmt.free()
        return { deletedCount: arr.length }
      }
      db.exec('DELETE FROM plugins')
      return { deletedCount: 0 }
    }
    return { deletedCount: 0 }
  }

  async countDocuments() {
    await init()
    if (this.name === 'plugins') {
      const rows = db.exec('SELECT COUNT(1) as c FROM plugins')
      const c = rows.length ? Number(rows[0].values[0][0]) : 0
      return c
    }
    const rows = db.exec('SELECT COUNT(1) as c FROM system_settings')
    const c = rows.length ? Number(rows[0].values[0][0]) : 0
    return c
  }

  async findOneAndUpdate(
    filter: Record<string, any>,
    update: { $inc?: Doc; $set?: Doc },
    _opts?: any
  ) {
    await init()
    if (this.name === 'system_settings') {
      const id = filter._id
      const stmt = db.prepare('SELECT data FROM system_settings WHERE id = ?')
      stmt.bind([id])
      let cur: any = {}
      if (stmt.step()) {
        const row = stmt.getAsObject() as any
        cur = JSON.parse(String(row.data))
      }
      stmt.free()
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          const n = typeof cur[k] === 'number' ? cur[k] : 0
          cur[k] = n + (v as number)
        }
      }
      if (update.$set) {
        cur = { ...cur, ...update.$set }
      }
      const data = JSON.stringify(cur)
      const sel = db.prepare('SELECT 1 FROM system_settings WHERE id = ?')
      sel.bind([id])
      const exists = sel.step()
      sel.free()
      if (exists) {
        const upd = db.prepare(
          'UPDATE system_settings SET data = ? WHERE id = ?'
        )
        upd.run([data, id])
        upd.free()
      } else {
        const ins = db.prepare(
          'INSERT INTO system_settings (id, data) VALUES (?, ?)'
        )
        ins.run([id, data])
        ins.free()
      }
      return { value: cur }
    }
    return { value: null }
  }
}

export async function getPluginsCollection(collectionName = 'plugins') {
  await init()
  return new SqliteCollection(collectionName)
}

export async function closeDB() {
  if (!db) return
  const binaryArray = db.export()
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
  await fs.writeFile(DB_PATH, Buffer.from(binaryArray))
}
