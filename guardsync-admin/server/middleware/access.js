import db from '../db.js';
import { forbidden } from '../utils/responses.js';

/**
 * Record-level access rules.
 *
 * authMiddleware checks who is logged in and their role. These helpers add the
 * second question: whose record is being asked for? Staff and admin pass through;
 * a guard may only read or change their own records.
 */

const DENIED = 'You can only access your own records';

export const isGuard = (req) => req.user?.role === 'guard';

/** The guard id in the URL must be the logged-in guard's own. */
export const ownParam = (name = 'guardId') => (req, res, next) => {
  if (!isGuard(req) || req.params[name] === req.user.id) return next();
  return forbidden(res, DENIED);
};

/**
 * Whatever guard id a guard sends in the body, the record is created as themselves.
 * Both spellings are set because bodies arrive snake_cased and handlers read either.
 */
export const actAsSelf = (req, res, next) => {
  if (isGuard(req) && req.body && typeof req.body === 'object') {
    req.body.guard_id = req.user.id;
    req.body.guardId = req.user.id;
  }
  next();
};

/** List routes: a guard only ever sees their own rows, whatever filter they ask for. */
export const scopeQueryToSelf = (req, res, next) => {
  if (isGuard(req)) {
    req.query.guard_id = req.user.id;
    req.query.guardId = req.user.id;
  }
  next();
};

/** Routes addressed by a record id: the row must belong to the logged-in guard. */
export const ownsRow = (table, column = 'guardId') => (req, res, next) => {
  if (!isGuard(req)) return next();
  const row = db.prepare(`SELECT ${column} AS owner FROM ${table} WHERE id = ?`).get(req.params.id);
  if (!row) return next(); // let the handler answer "not found"
  return row.owner === req.user.id ? next() : forbidden(res, DENIED);
};

/** The site a guard is assigned to, or null. */
export const guardSiteId = (req) =>
  db.prepare('SELECT siteId FROM guards WHERE id = ?').get(req.user.id)?.siteId || null;

/** A guard may only look at the site they are assigned to. */
export const ownSiteParam = (name = 'id') => (req, res, next) => {
  if (!isGuard(req) || req.params[name] === guardSiteId(req)) return next();
  return forbidden(res, 'You can only access your own site');
};
