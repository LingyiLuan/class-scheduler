/**
 * 共享类型定义。
 * 各数据表的行类型（Student / ClassSession 等）在数据层阶段
 * 依据 docs/schema.sql 生成，届时补充到本目录。
 */

/** UUID 字符串 */
export type UUID = string

/** ISO8601 时间戳字符串（数据库 timestamptz 的前端表示） */
export type ISODateTime = string
