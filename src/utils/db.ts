import fs from 'node:fs/promises'
import path from 'node:path'

type Doc = Record<string, any>

const CACHE_DIR = path.resolve('.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'localdb.json')

let store: Record<string, Doc[]> | null = null

async function ensureLoaded() {
  if (store) return
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8')
    store = JSON.parse(data) as Record<string, Doc[]>
  } catch {
    store = {}
  }
}

async function persist() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.writeFile(CACHE_FILE, JSON.stringify(store || {}, null, 2), 'utf-8')
}

function getByPath(obj: any, dotted: string) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj)
}

function match(doc: Doc, filter: Record<string, any>): boolean {
  for (const [key, cond] of Object.entries(filter || {})) {
    const val = getByPath(doc, key)
    if (cond && typeof cond === 'object') {
      if ('$exists' in cond) {
        const exists = cond.$exists
        if (exists ? val === undefined : val !== undefined) return false
      }
      if ('$in' in cond) {
        const arr = cond.$in as any[]
        if (!arr.includes(val)) return false
      }
    } else {
      if (val !== cond) return false
    }
  }
  return true
}

function applySet(doc: Doc, setObj: Doc) {
  for (const [k, v] of Object.entries(setObj || {})) {
    // 支持点路径设置
    const parts = k.split('.')
    let cur = doc
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (typeof cur[p] !== 'object' || cur[p] == null) cur[p] = {}
      cur = cur[p]
    }
    cur[parts[parts.length - 1]] = v
  }
}

class LocalCollection {
  name: string
  constructor(name: string) {
    this.name = name
  }

  find(filter?: Record<string, any>) {
    const run = async () => {
      await ensureLoaded()
      const data = (store![this.name] || []).filter((d) =>
        match(d, filter || {})
      )
      return data
    }
    return {
      toArray: () => run()
    }
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
    await ensureLoaded()
    const coll = (store![this.name] = store![this.name] || [])
    let doc = coll.find((d) => match(d, filter))
    if (!doc && opts?.upsert) {
      doc = {}
      coll.push(doc)
    }
    if (doc && update?.$set) applySet(doc, update.$set)
    await persist()
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
    for (const op of ops) {
      const { filter, update, upsert } = op.updateOne
      await this.updateOne(filter, update, { upsert })
    }
  }

  async deleteMany(filter: Record<string, any>) {
    await ensureLoaded()
    const coll = (store![this.name] = store![this.name] || [])
    const remaining = coll.filter((d) => !match(d, filter))
    store![this.name] = remaining
    await persist()
    return { deletedCount: coll.length - remaining.length }
  }

  async countDocuments() {
    await ensureLoaded()
    return (store![this.name] || []).length
  }

  async findOneAndUpdate(
    filter: Record<string, any>,
    update: { $inc?: Doc; $set?: Doc },
    _opts?: any
  ) {
    await ensureLoaded()
    const coll = (store![this.name] = store![this.name] || [])
    let doc = coll.find((d) => match(d, filter))
    if (!doc) {
      doc = {}
      coll.push(doc)
    }
    if (update?.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        const cur = getByPath(doc, k)
        applySet(doc, {
          [k]: (typeof cur === 'number' ? cur : 0) + (v as number)
        })
      }
    }
    if (update?.$set) applySet(doc, update.$set)
    await persist()
    return { value: doc }
  }
}

export async function getPluginsCollection(collectionName = 'plugins') {
  await ensureLoaded()
  return new LocalCollection(collectionName)
}

export async function closeDB() {
  await persist()
}
