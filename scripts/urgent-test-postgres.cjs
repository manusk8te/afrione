// Adapts the small dispatch query surface to a disposable PostgreSQL cluster.
const { execFile } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { promisify } = require('node:util')
const run = promisify(execFile)
const assert = require('node:assert/strict')

const identifier = value => {
  assert.match(value, /^[a-z_][a-z0-9_]*$/)
  return '"' + value + '"'
}
const literal = value => value === null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'"

async function sql(statement) {
  assert.match(process.env.PGHOST ?? '', /^(?:\/private)?\/tmp\/afrione-qa\.[a-zA-Z0-9]+$/)
  assert.equal(process.env.PGPORT, '55491')
  assert.equal(process.env.PGDATABASE, 'postgres')
  const { stdout } = await run('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', statement])
  return stdout.trim()
}

class Query {
  filters = []
  operation = 'select'
  projection = '*'

  constructor(table, actor) {
    this.table = identifier(table)
    this.actor = actor
  }

  select(columns = '*') { this.projection = columns; return this }
  insert(values) { this.operation = 'insert'; this.values = values; return this }
  upsert(values) { return this.insert(values) }
  update(values) { this.operation = 'update'; this.values = values; return this }
  delete() { this.operation = 'delete'; return this }
  eq(key, value) { return this.filter(key, '=', value) }
  neq(key, value) { return this.filter(key, '<>', value) }
  is(key, value) { return this.filter(key, 'IS', value) }
  gt(key, value) { return this.filter(key, '>', value) }
  in(key, values) { this.filters.push(identifier(key) + ' IN (' + values.map(literal).join(',') + ')'); return this }
  filter(key, op, value) { this.filters.push(identifier(key) + ' ' + op + ' ' + literal(value)); return this }
  order(key, options = { ascending: true }) { this.sort = ' ORDER BY ' + identifier(key) + (options.ascending ? ' ASC' : ' DESC'); return this }
  limit(count) { this.max = ' LIMIT ' + Number(count); return this }
  range(from, to) { this.max = ' LIMIT ' + (to - from + 1) + ' OFFSET ' + from; return this }
  single() { this.one = true; return this }
  maybeSingle() { return this.single() }

  async execute() {
    const where = this.filters.length ? ' WHERE ' + this.filters.join(' AND ') : ''
    const values = this.values ?? {}
    const assignments = Object.entries(values).map(([key, value]) => identifier(key) + '=' + literal(value))
    const projection = this.projection === 'id' || this.projection === '*' ? this.projection : '*'
    const joins = {
      'users!artisan_pros_user_id_fkey(name, avatar_url, quartier)': ['users', 'user_id'],
      'users!artisan_pros_user_id_fkey(name)': ['users', 'user_id'],
      'missions(category, total_price, quartier, mode)': ['missions', 'mission_id'],
    }
    let fields = projection
    for (const [expression, [table, foreignKey]] of Object.entries(joins)) {
      if (this.projection.includes(expression)) {
        fields += ', (SELECT to_jsonb(related) FROM ' + identifier(table) + ' related WHERE related.id = base.' + identifier(foreignKey) + ') AS ' + identifier(table)
      }
    }
    let query
    if (this.operation === 'select') query = 'SELECT ' + fields + ' FROM ' + this.table + ' base' + where + (this.sort ?? '') + (this.max ?? '')
    if (this.operation === 'insert') query = 'INSERT INTO ' + this.table + '(' + Object.keys(values).map(identifier).join(',') + ') VALUES (' + Object.values(values).map(literal).join(',') + ') RETURNING *'
    if (this.operation === 'update') query = 'UPDATE ' + this.table + ' SET ' + assignments.join(',') + where + ' RETURNING *'
    if (this.operation === 'delete') query = 'DELETE FROM ' + this.table + where + ' RETURNING *'
    const session = this.actor ? 'SET ROLE authenticated; SET request.jwt.claim.sub = ' + literal(this.actor) + '; ' : ''
    try {
      const output = await sql(session + 'WITH rows AS (' + query + ") SELECT coalesce(json_agg(rows), '[]') FROM rows;")
      const rows = JSON.parse(output)
      if (this.one && rows.length > 1) throw Error('Expected at most one row')
      return { data: this.one ? rows[0] ?? null : rows, error: null }
    } catch (error) {
      return { data: null, error: { message: error.stderr?.trim() || error.message } }
    }
  }

  then(resolve, reject) { return this.execute().then(resolve, reject) }
}

const postgresClient = actor => ({
  from: table => new Query(table, actor),
  rpc: async name => {
    assert.equal(name, 'list_urgent_offers')
    assert.match(actor, /^[a-f0-9-]{36}$/)
    const output = await sql('SET ROLE authenticated; SET request.jwt.claim.sub = ' + literal(actor)
      + "; SELECT coalesce(json_agg(offer), '[]') FROM public.list_urgent_offers() offer;")
    return { data: JSON.parse(output) }
  },
  removeAllChannels: async () => {},
  auth: { admin: {
    createUser: async () => ({ data: { user: { id: randomUUID() } } }),
    deleteUser: async () => ({ data: null }),
  } },
})

module.exports = { postgresClient }
