function toRowsLimit(rows, limit = 100) {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit)
}

async function queryModelOrderSearch(pool, modelHint) {
  const q = `%${String(modelHint || "").trim()}%`
  const sql = `
    WITH box_lines AS (
      SELECT
        b.uid,
        b.zakaz,
        b.status,
        b.model AS model,
        b.color AS color,
        e.key AS size,
        (e.value)::int AS qty
      FROM boxes b
      LEFT JOIN LATERAL jsonb_each_text(COALESCE(b.sizes, '{}'::jsonb)) e ON b.type = 'simple'
      WHERE b.type = 'simple'
      UNION ALL
      SELECT
        b.uid,
        b.zakaz,
        b.status,
        item->>'model' AS model,
        item->>'color' AS color,
        e.key AS size,
        (e.value)::int AS qty
      FROM boxes b
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(b.items, '[]'::jsonb)) item ON b.type = 'mix'
      LEFT JOIN LATERAL jsonb_each_text(COALESCE(item->'sizes', '{}'::jsonb)) e ON b.type = 'mix'
      WHERE b.type = 'mix'
    )
    SELECT
      COALESCE(bl.model, '') AS model,
      COALESCE(bl.color, '') AS color,
      COALESCE(bl.size, '-') AS size,
      bl.zakaz AS order_number,
      COUNT(DISTINCT bl.uid)::int AS box_count,
      COALESCE(SUM(bl.qty), 0)::int AS total_qty
    FROM box_lines bl
    WHERE (
      bl.model ILIKE $1 OR bl.color ILIKE $1 OR bl.zakaz ILIKE $1 OR bl.uid ILIKE $1
    )
    GROUP BY bl.model, bl.color, bl.size, bl.zakaz
    ORDER BY total_qty DESC, box_count DESC
    LIMIT 100;
  `
  const { rows } = await pool.query(sql, [q])
  return toRowsLimit(rows, 100)
}

async function querySizeBreakdown(pool, modelHint) {
  const q = `%${String(modelHint || "").trim()}%`
  const sql = `
    WITH box_lines AS (
      SELECT
        b.uid,
        b.zakaz,
        b.model AS model,
        b.color AS color,
        e.key AS size,
        (e.value)::int AS qty
      FROM boxes b
      LEFT JOIN LATERAL jsonb_each_text(COALESCE(b.sizes, '{}'::jsonb)) e ON b.type = 'simple'
      WHERE b.type = 'simple'
      UNION ALL
      SELECT
        b.uid,
        b.zakaz,
        item->>'model' AS model,
        item->>'color' AS color,
        e.key AS size,
        (e.value)::int AS qty
      FROM boxes b
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(b.items, '[]'::jsonb)) item ON b.type = 'mix'
      LEFT JOIN LATERAL jsonb_each_text(COALESCE(item->'sizes', '{}'::jsonb)) e ON b.type = 'mix'
      WHERE b.type = 'mix'
    )
    SELECT
      COALESCE(model, '') AS model,
      COALESCE(color, '') AS color,
      COALESCE(size, '-') AS size,
      COUNT(DISTINCT uid)::int AS box_count,
      COALESCE(SUM(qty), 0)::int AS total_qty
    FROM box_lines
    WHERE model ILIKE $1 OR color ILIKE $1 OR zakaz ILIKE $1
    GROUP BY model, color, size
    ORDER BY model, color, size
    LIMIT 100;
  `
  const { rows } = await pool.query(sql, [q])
  return toRowsLimit(rows, 100)
}

async function queryOrderProgress(pool, threshold) {
  const safeThreshold = Number(threshold) || 70
  const sql = `
    WITH boxed AS (
      SELECT
        bl.zakaz AS order_number,
        COALESCE(SUM(bl.qty), 0)::int AS boxed_qty
      FROM (
        SELECT b.zakaz, (e.value)::int AS qty
        FROM boxes b
        LEFT JOIN LATERAL jsonb_each_text(COALESCE(b.sizes, '{}'::jsonb)) e ON b.type = 'simple'
        WHERE b.type = 'simple'
        UNION ALL
        SELECT b.zakaz, (e.value)::int AS qty
        FROM boxes b
        LEFT JOIN LATERAL jsonb_array_elements(COALESCE(b.items, '[]'::jsonb)) item ON b.type = 'mix'
        LEFT JOIN LATERAL jsonb_each_text(COALESCE(item->'sizes', '{}'::jsonb)) e ON b.type = 'mix'
        WHERE b.type = 'mix'
      ) bl
      GROUP BY bl.zakaz
    )
    SELECT
      o.id AS order_number,
      o.model,
      o.color,
      o.total::int AS planned_qty,
      COALESCE(b.boxed_qty, 0)::int AS boxed_qty,
      ROUND(
        CASE WHEN o.total > 0 THEN (COALESCE(b.boxed_qty, 0)::numeric / o.total::numeric) * 100 ELSE 0 END
      , 2) AS progress_percent
    FROM orders o
    LEFT JOIN boxed b ON b.order_number = o.id
    WHERE
      CASE WHEN o.total > 0 THEN (COALESCE(b.boxed_qty, 0)::numeric / o.total::numeric) * 100 ELSE 0 END >= $1
    ORDER BY progress_percent DESC, order_number
    LIMIT 100;
  `
  const { rows } = await pool.query(sql, [safeThreshold])
  return toRowsLimit(rows, 100)
}

async function queryShipmentReadiness(pool, threshold) {
  return queryOrderProgress(pool, threshold || 100)
}

async function queryTodayShipmentSummary(pool) {
  const sql = `
    SELECT
      s.id AS shipment_id,
      s.status,
      s.created_at,
      s.closed_at,
      COALESCE(jsonb_array_length(s.box_uids), 0)::int AS box_count
    FROM shipments s
    WHERE s.created_at::date = CURRENT_DATE OR s.closed_at::date = CURRENT_DATE
    ORDER BY s.created_at DESC
    LIMIT 50;
  `
  const { rows } = await pool.query(sql)
  return toRowsLimit(rows, 50)
}

async function querySurplus(pool) {
  const sql = `
    WITH shipped_orders AS (
      SELECT DISTINCT zakaz
      FROM boxes
      WHERE status = 'shipped'
    )
    SELECT
      b.zakaz AS order_number,
      COALESCE(b.model, '') AS model,
      COALESCE(b.color, '') AS color,
      COUNT(DISTINCT b.uid)::int AS box_count,
      COALESCE(SUM(
        CASE
          WHEN b.type = 'simple' THEN (
            SELECT COALESCE(SUM((v.value)::int), 0) FROM jsonb_each_text(COALESCE(b.sizes, '{}'::jsonb)) v
          )
          ELSE (
            SELECT COALESCE(SUM((v.value)::int), 0)
            FROM jsonb_array_elements(COALESCE(b.items, '[]'::jsonb)) i,
                 jsonb_each_text(COALESCE(i->'sizes', '{}'::jsonb)) v
          )
        END
      ), 0)::int AS total_qty
    FROM boxes b
    INNER JOIN shipped_orders so ON so.zakaz = b.zakaz
    WHERE b.status = 'warehouse'
    GROUP BY b.zakaz, b.model, b.color
    ORDER BY total_qty DESC, box_count DESC
    LIMIT 100;
  `
  const { rows } = await pool.query(sql)
  return toRowsLimit(rows, 100)
}

async function queryMismatch(pool) {
  const sql = `
    WITH boxed AS (
      SELECT
        bl.zakaz AS order_number,
        COALESCE(SUM(bl.qty), 0)::int AS boxed_qty
      FROM (
        SELECT b.zakaz, (e.value)::int AS qty
        FROM boxes b
        LEFT JOIN LATERAL jsonb_each_text(COALESCE(b.sizes, '{}'::jsonb)) e ON b.type = 'simple'
        WHERE b.type = 'simple'
        UNION ALL
        SELECT b.zakaz, (e.value)::int AS qty
        FROM boxes b
        LEFT JOIN LATERAL jsonb_array_elements(COALESCE(b.items, '[]'::jsonb)) item ON b.type = 'mix'
        LEFT JOIN LATERAL jsonb_each_text(COALESCE(item->'sizes', '{}'::jsonb)) e ON b.type = 'mix'
        WHERE b.type = 'mix'
      ) bl
      GROUP BY bl.zakaz
    )
    SELECT
      o.id AS order_number,
      o.model,
      o.color,
      o.total::int AS planned_qty,
      COALESCE(b.boxed_qty, 0)::int AS boxed_qty,
      (COALESCE(b.boxed_qty, 0)::int - o.total::int) AS diff_qty
    FROM orders o
    LEFT JOIN boxed b ON b.order_number = o.id
    WHERE COALESCE(b.boxed_qty, 0)::int <> o.total::int
    ORDER BY ABS(COALESCE(b.boxed_qty, 0)::int - o.total::int) DESC
    LIMIT 100;
  `
  const { rows } = await pool.query(sql)
  return toRowsLimit(rows, 100)
}

async function runIntentQuery(pool, parsed) {
  switch (parsed.intent) {
    case "size_breakdown":
      return querySizeBreakdown(pool, parsed.modelHint)
    case "order_progress":
      return queryOrderProgress(pool, parsed.threshold)
    case "shipment_readiness":
      return queryShipmentReadiness(pool, parsed.threshold || 100)
    case "shipment_today_summary":
      return queryTodayShipmentSummary(pool)
    case "surplus_inventory":
      return querySurplus(pool)
    case "mismatch_audit":
      return queryMismatch(pool)
    case "model_order_search":
    default:
      return queryModelOrderSearch(pool, parsed.modelHint)
  }
}

module.exports = {
  runIntentQuery,
}
