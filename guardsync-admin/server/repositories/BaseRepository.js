/**
 * BaseRepository - Common database operations abstraction layer
 * 
 * To migrate to PostgreSQL in the future:
 * 1. Create PostgreSQL-specific repository implementations (e.g., BaseRepositoryPG.js)
 * 2. Update the database connection in db.js to use pg/postgres instead of better-sqlite3
 * 3. Route handlers need ZERO changes - they only call repository methods
 * 4. Replace SQLite-specific syntax (e.g., AUTOINCREMENT → SERIAL, ? → $1, $2...)
 * 
 * This abstraction layer isolates all SQL queries, making database migration straightforward.
 */

export class BaseRepository {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Find all records
   * @param {string} orderBy - Optional ORDER BY clause (e.g., 'createdAt DESC')
   * @returns {Array} Array of all records
   */
  findAll(orderBy = null) {
    const query = orderBy 
      ? `SELECT * FROM ${this.tableName} ORDER BY ${orderBy}`
      : `SELECT * FROM ${this.tableName}`;
    return this.db.prepare(query).all();
  }

  /**
   * Find record by ID
   * @param {string} id - Record ID
   * @returns {Object|undefined} Single record or undefined
   */
  findById(id) {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
  }

  /**
   * Find records by a specific field
   * @param {string} field - Column name
   * @param {any} value - Value to match
   * @returns {Array} Array of matching records
   */
  findBy(field, value) {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`).all(value);
  }

  /**
   * Find single record by a specific field
   * @param {string} field - Column name
   * @param {any} value - Value to match
   * @returns {Object|undefined} Single record or undefined
   */
  findOneBy(field, value) {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`).get(value);
  }

  /**
   * Create a new record
   * @param {Object} data - Key-value pairs for the record
   * @returns {Object} The created record with insertion info
   */
  create(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const columns = keys.join(', ');
    const values = keys.map(k => data[k]);

    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    const result = this.db.prepare(query).run(...values);
    
    return { ...result, id: data.id || result.lastInsertRowid };
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Key-value pairs to update
   * @returns {Object} Update result info
   */
  update(id, data) {
    const keys = Object.keys(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => data[k]), id];

    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    return this.db.prepare(query).run(...values);
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Object} Deletion result info
   */
  delete(id) {
    return this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  /**
   * Count all records
   * @returns {number} Total count
   */
  count() {
    const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get();
    return result.count;
  }

  /**
   * Execute custom query with parameters
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Array} Query results
   */
  query(query, params = []) {
    return this.db.prepare(query).all(...params);
  }

  /**
   * Execute custom query that returns single result
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Object|undefined} Single result or undefined
   */
  queryOne(query, params = []) {
    return this.db.prepare(query).get(...params);
  }

  /**
   * Execute custom statement (INSERT, UPDATE, DELETE)
   * @param {string} query - SQL statement
   * @param {Array} params - Statement parameters
   * @returns {Object} Execution result info
   */
  execute(query, params = []) {
    return this.db.prepare(query).run(...params);
  }

  /**
   * Begin a transaction - useful for complex multi-table operations
   * @param {Function} callback - Function containing transaction logic
   * @returns {any} Result of the transaction callback
   */
  transaction(callback) {
    const txn = this.db.transaction(callback);
    return txn();
  }
}
