-- Marcador por cámara: qué datos del partido maneja el lector (celular
-- apuntando al marcador físico del estadio) en vez de la Mesa.
-- { "activo": bool, "reloj": bool, "puntos": bool, "periodo": bool, "faltas": bool }
-- '{}' = manual (el comportamiento de siempre).
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS sincronizacion_camara JSONB NOT NULL DEFAULT '{}'::jsonb;
