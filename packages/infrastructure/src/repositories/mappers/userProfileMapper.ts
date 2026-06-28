import {
  BodyMeasurements,
  type BodyShape,
  Color,
  ColorPalette,
  type StyleAesthetic,
  StylePreference,
  UserProfile,
  toId,
} from '@mas/core';

import { mustOk, parseJson, toBool, toJson } from './mapperUtils';

/** Raw `user_profiles` table row. */
export interface UserProfileRow {
  id: string;
  name: string;
  body_measurements: string | null;
  style_preference: string | null;
  color_palette: string | null;
  is_current: number;
}

interface BodyMeasurementsJson {
  heightCm: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  shape?: string;
}

interface StylePreferenceJson {
  aesthetics: string[];
  preferredColors: string[];
  avoidedColors: string[];
  boldnessAffinity: number;
  comfortPriority: number;
}

interface ColorJson {
  hex: string;
  name?: string;
}

interface ColorPaletteJson {
  primary: ColorJson;
  secondary: ColorJson;
  accent: ColorJson;
  neutral: ColorJson;
}

const colorFromJson = (json: ColorJson, role: string): Color =>
  mustOk(Color.fromHex(json.hex, json.name), `palette ${role}`);

/** Reconstruct a {@link UserProfile} aggregate from a row. */
export const userProfileToDomain = (row: UserProfileRow): UserProfile => {
  let bodyMeasurements: BodyMeasurements | undefined;
  const bm = parseJson<BodyMeasurementsJson | null>(
    row.body_measurements,
    null,
    `profile ${row.id} measurements`,
  );
  if (bm !== null) {
    bodyMeasurements = mustOk(
      BodyMeasurements.create({
        heightCm: bm.heightCm,
        ...(bm.chestCm !== undefined ? { chestCm: bm.chestCm } : {}),
        ...(bm.waistCm !== undefined ? { waistCm: bm.waistCm } : {}),
        ...(bm.hipsCm !== undefined ? { hipsCm: bm.hipsCm } : {}),
        ...(bm.shape !== undefined ? { shape: bm.shape as BodyShape } : {}),
      }),
      `profile ${row.id} measurements`,
    );
  }

  let stylePreference: StylePreference | undefined;
  const sp = parseJson<StylePreferenceJson | null>(
    row.style_preference,
    null,
    `profile ${row.id} preferences`,
  );
  if (sp !== null) {
    stylePreference = mustOk(
      StylePreference.create({
        aesthetics: sp.aesthetics as StyleAesthetic[],
        preferredColors: sp.preferredColors,
        avoidedColors: sp.avoidedColors,
        boldnessAffinity: sp.boldnessAffinity,
        comfortPriority: sp.comfortPriority,
      }),
      `profile ${row.id} preferences`,
    );
  }

  let colorPalette: ColorPalette | undefined;
  const cp = parseJson<ColorPaletteJson | null>(
    row.color_palette,
    null,
    `profile ${row.id} palette`,
  );
  if (cp !== null) {
    colorPalette = mustOk(
      ColorPalette.create({
        primary: colorFromJson(cp.primary, 'primary'),
        secondary: colorFromJson(cp.secondary, 'secondary'),
        accent: colorFromJson(cp.accent, 'accent'),
        neutral: colorFromJson(cp.neutral, 'neutral'),
      }),
      `profile ${row.id} palette`,
    );
  }

  return mustOk(
    UserProfile.create(toId<'UserProfile'>(row.id), {
      name: row.name,
      ...(bodyMeasurements !== undefined ? { bodyMeasurements } : {}),
      ...(stylePreference !== undefined ? { stylePreference } : {}),
      ...(colorPalette !== undefined ? { colorPalette } : {}),
    }),
    `profile ${row.id}`,
  );
};

const colorToJson = (color: Color): ColorJson =>
  color.name !== undefined ? { hex: color.hex, name: color.name } : { hex: color.hex };

/** Flatten a {@link UserProfile} into a row. `isCurrent` is supplied by the repo. */
export const userProfileToRow = (profile: UserProfile, isCurrent: boolean): UserProfileRow => {
  const bm = profile.bodyMeasurements;
  const sp = profile.stylePreference;
  const cp = profile.colorPalette;

  const bmJson: BodyMeasurementsJson | null = bm
    ? {
        heightCm: bm.heightCm,
        ...(bm.chestCm !== undefined ? { chestCm: bm.chestCm } : {}),
        ...(bm.waistCm !== undefined ? { waistCm: bm.waistCm } : {}),
        ...(bm.hipsCm !== undefined ? { hipsCm: bm.hipsCm } : {}),
        shape: bm.shape,
      }
    : null;

  const spJson: StylePreferenceJson | null = sp
    ? {
        aesthetics: [...sp.aesthetics],
        preferredColors: [...sp.preferredColors],
        avoidedColors: [...sp.avoidedColors],
        boldnessAffinity: sp.boldnessAffinity,
        comfortPriority: sp.comfortPriority,
      }
    : null;

  const cpJson: ColorPaletteJson | null = cp
    ? {
        primary: colorToJson(cp.primary),
        secondary: colorToJson(cp.secondary),
        accent: colorToJson(cp.accent),
        neutral: colorToJson(cp.neutral),
      }
    : null;

  return {
    id: profile.id,
    name: profile.name,
    body_measurements: bmJson ? toJson(bmJson) : null,
    style_preference: spJson ? toJson(spJson) : null,
    color_palette: cpJson ? toJson(cpJson) : null,
    is_current: isCurrent ? 1 : 0,
  };
};

/** Read the `is_current` flag from a row. */
export const isCurrentProfile = (row: UserProfileRow): boolean => toBool(row.is_current);
