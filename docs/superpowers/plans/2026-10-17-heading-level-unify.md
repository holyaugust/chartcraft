# Heading Level Unify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify heading-level detection across TOC/format/proofread, fix Arabic-numeral false positives, and add nest/order structure checks.

**Architecture:** Canonical `resolveHeadingOutlineLevel` + `extractDocumentHeadings` in `documentHeadings.ts`; format normalize maps to h1–h4; structural proofread consumes the same headings for locatable issues.

**Tech Stack:** TypeScript, Vitest, existing document utils

**Spec:** Chat-approved three-step design (unify API, fix Arabic L1 false positive, nest/order checks)

## File map

- `src/utils/documentHeadings.ts` — canonical level resolver + extract
- `src/utils/documentFormatNormalize.ts` — `detectHeadingLevel` delegates to canonical
- `src/utils/documentStructureProofread.ts` — replace badHierarchy; enhance order/skip/mix
- Tests: `documentHeadings.test.ts`, `documentProofread.heading.test.ts`

## Task 1: Unified resolver

- [x] RED: tests for L1/L2/L3/L4 + arabic not L1 when `一、` present
- [x] GREEN: implement `resolveHeadingOutlineLevel`, wire `extractDocumentHeadings`
- [x] GREEN: `detectHeadingLevel` maps 1→h1 … 4→h4

## Task 2: Arabic misuse rule

- [x] RED: with `一、`+`1.` no bulk L1 warning; with only `1、2、` locatable warnings
- [x] GREEN: replace `badHierarchy` document-level issue

## Task 3: Structure checks

- [x] RED: skip level (L1→L3), ordinal regress, mixed L2 styles
- [x] GREEN: implement via shared headings walk

## Task 4: Verify

- [x] Run heading + pageBlocks + structure proofread related tests
