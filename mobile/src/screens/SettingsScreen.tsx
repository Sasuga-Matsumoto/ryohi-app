/**
 * モバイル設定画面
 * Web の SettingsForm 相当の項目を mobile で完結させる
 *
 * 設計ポイント:
 * - 各フィールドは変更時に即サーバ送信（debounce 600ms）
 * - 送信中はインジケータ・失敗時はトースト
 * - 自宅・勤務地は LocationPickerMap モーダル
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  fetchFullSetting,
  updateSetting,
  DEFAULT_PURPOSE_PRESETS_MOBILE,
  type FullSetting,
} from "../lib/settings";
import LocationPickerMap, { type LatLng } from "../components/LocationPickerMap";
import {
  colors,
  spacing,
  radius,
  typography,
  TOUCH_MIN,
} from "../lib/theme";

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [setting, setSetting] = useState<FullSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pickerKind, setPickerKind] = useState<"home" | "work" | null>(null);
  const [pickerSelection, setPickerSelection] = useState<LatLng | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初期ロード
  useEffect(() => {
    (async () => {
      const s = await fetchFullSetting();
      setSetting(s);
    })();
  }, []);

  // 部分更新 + 自動保存（debounce 600ms）
  const persistDebounced = (patch: Partial<FullSetting>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      const r = await updateSetting(patch);
      setSaving(false);
      if (!r.ok) {
        Alert.alert("保存失敗", r.error ?? "もう一度お試しください");
      } else {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    }, 600);
  };

  const update = <K extends keyof FullSetting>(k: K, v: FullSetting[K]) => {
    setSetting((cur) => (cur ? { ...cur, [k]: v } : cur));
    persistDebounced({ [k]: v } as Partial<FullSetting>);
  };

  // 自宅・勤務地ピッカー保存
  const openPicker = (kind: "home" | "work") => {
    if (!setting) return;
    const initial =
      kind === "home"
        ? setting.home_lat != null && setting.home_lng != null
          ? { lat: setting.home_lat, lng: setting.home_lng }
          : null
        : setting.work_lat != null && setting.work_lng != null
          ? { lat: setting.work_lat, lng: setting.work_lng }
          : null;
    setPickerSelection(initial);
    setPickerKind(kind);
  };

  const closePicker = () => {
    setPickerKind(null);
    setPickerSelection(null);
  };

  const savePicker = async () => {
    if (!pickerKind || !pickerSelection || !setting) return;
    setSaving(true);
    const patch =
      pickerKind === "home"
        ? { home_lat: pickerSelection.lat, home_lng: pickerSelection.lng }
        : { work_lat: pickerSelection.lat, work_lng: pickerSelection.lng };
    const r = await updateSetting(patch);
    setSaving(false);
    if (!r.ok) {
      Alert.alert("保存失敗", r.error ?? "");
      return;
    }
    setSetting({ ...setting, ...patch });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    closePicker();
  };

  if (!setting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.cancel}>閉じる</Text>
          </TouchableOpacity>
          <Text style={styles.title}>設定</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.textMuted }}>読み込み中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={styles.cancel}>閉じる</Text>
        </TouchableOpacity>
        <Text style={styles.title}>設定</Text>
        <View style={styles.statusWrap}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : savedFlash ? (
            <Feather name="check" color={colors.success} size={18} />
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ベース設定 */}
        <SectionHeader step={1} title="ベース設定" hint="自宅と勤務地を地図で指定" />

        <PlaceCard
          label="自宅"
          icon="home"
          lat={setting.home_lat}
          lng={setting.home_lng}
          onEdit={() => openPicker("home")}
        />
        <PlaceCard
          label="勤務地"
          icon="briefcase"
          lat={setting.work_lat}
          lng={setting.work_lng}
          onEdit={() => openPicker("work")}
        />

        {/* 判定ルール */}
        <SectionHeader step={2} title="判定ルール" hint="出張の判定方法を調整" />

        {/* 出張定義 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>出張定義</Text>
          <Text style={styles.cardHelper}>
            どのような状態を「出張」とみなすか
          </Text>
          <RadioRow
            label="時間で判定"
            selected={setting.trip_definition_type === "hours"}
            onPress={() => update("trip_definition_type", "hours")}
          >
            <NumberInput
              value={setting.trip_threshold_hours}
              onChange={(v) => update("trip_threshold_hours", v)}
              min={1}
              suffix="時間以上"
              disabled={setting.trip_definition_type !== "hours"}
            />
          </RadioRow>
          <RadioRow
            label="距離で判定"
            selected={setting.trip_definition_type === "km"}
            onPress={() => update("trip_definition_type", "km")}
          >
            <NumberInput
              value={setting.trip_threshold_km}
              onChange={(v) => update("trip_threshold_km", v)}
              min={1}
              suffix="km以上"
              disabled={setting.trip_definition_type !== "km"}
            />
          </RadioRow>
        </View>

        {/* 業務時間 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>業務時間</Text>
          <Text style={styles.cardHelper}>
            設定するとその時間帯外の外出は出張に含めません
          </Text>
          <SwitchRow
            label="業務時間を設定する"
            value={setting.business_hours_enabled}
            onChange={(v) => update("business_hours_enabled", v)}
          />
          {setting.business_hours_enabled && (
            <View style={styles.timeRow}>
              <TimeInput
                value={setting.business_hours_start}
                onChange={(v) => update("business_hours_start", v)}
              />
              <Text style={styles.timeSeparator}>〜</Text>
              <TimeInput
                value={setting.business_hours_end}
                onChange={(v) => update("business_hours_end", v)}
              />
            </View>
          )}
        </View>

        {/* 休日設定 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>休日設定</Text>
          <Text style={styles.cardHelper}>
            OFF にするとその日の出張は自動で除外（後から復元可能）
          </Text>
          <SwitchRow
            label="土日も出張対象に含める"
            value={setting.include_weekends}
            onChange={(v) => update("include_weekends", v)}
          />
          <SwitchRow
            label="日本の祝日も出張対象に含める"
            value={setting.include_holidays}
            onChange={(v) => update("include_holidays", v)}
          />
        </View>

        {/* 出張目的 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>出張目的</Text>
          <Text style={styles.cardHelper}>
            自動判定された出張の「目的」初期値とプリセット
          </Text>

          <Text style={styles.fieldLabel}>デフォルト目的</Text>
          <TextInput
            value={setting.default_purpose}
            onChangeText={(v) => update("default_purpose", v)}
            placeholder="顧客訪問"
            style={styles.input}
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing[4] }]}>
            プリセット
          </Text>
          <Text style={styles.cardHelper}>
            標準（{DEFAULT_PURPOSE_PRESETS_MOBILE.join(" / ")}）に追加できます
          </Text>
          <PresetEditor
            presets={setting.purpose_presets}
            onChange={(v) => update("purpose_presets", v)}
          />
        </View>
      </ScrollView>

      {/* 自宅・勤務地ピッカー Modal */}
      <Modal
        visible={pickerKind !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePicker}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={closePicker} hitSlop={12}>
              <Text style={styles.cancel}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {pickerKind === "home" ? "自宅エリア" : "勤務地エリア"}
            </Text>
            <TouchableOpacity
              onPress={savePicker}
              disabled={!pickerSelection || saving}
              hitSlop={12}
            >
              <Text
                style={[
                  styles.save,
                  (!pickerSelection || saving) && { color: colors.textDisabled },
                ]}
              >
                {saving ? "保存中…" : "保存"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, padding: spacing[4] }}>
            <Text style={[styles.cardHelper, { marginBottom: spacing[3] }]}>
              地図をタップしてピンを配置・ドラッグで微調整。
            </Text>
            <LocationPickerMap
              initial={pickerSelection}
              onChange={setPickerSelection}
              height={420}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────
// サブコンポーネント
// ─────────────────────────────────────

function SectionHeader({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionStep}>
        <Text style={styles.sectionStepText}>{step}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHint}>{hint}</Text>
      </View>
    </View>
  );
}

function PlaceCard({
  label,
  icon,
  lat,
  lng,
  onEdit,
}: {
  label: string;
  icon: "home" | "briefcase";
  lat: number | null;
  lng: number | null;
  onEdit: () => void;
}) {
  const isSet = lat != null && lng != null;
  return (
    <TouchableOpacity onPress={onEdit} style={styles.card} activeOpacity={0.7}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Feather name={icon} size={18} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{label}</Text>
          {isSet ? (
            <Text style={styles.placeMono}>
              {lat!.toFixed(6)}, {lng!.toFixed(6)}
            </Text>
          ) : (
            <Text style={styles.placeEmpty}>未設定 — タップして設定</Text>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={colors.textDisabled} />
      </View>
    </TouchableOpacity>
  );
}

function RadioRow({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.radioRow,
        selected && { borderColor: colors.primary, backgroundColor: colors.infoBg },
      ]}
    >
      <View style={styles.radioOuter}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {children}
    </TouchableOpacity>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  suffix: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TextInput
        value={draft}
        keyboardType="numeric"
        editable={!disabled}
        onChangeText={(s) => {
          setDraft(s);
          const n = parseInt(s.replace(/[^\d]/g, ""), 10);
          if (Number.isFinite(n) && n >= min) onChange(n);
        }}
        style={[
          styles.numberInput,
          disabled && { color: colors.textDisabled },
        ]}
      />
      <Text
        style={{
          ...typography.caption,
          color: disabled ? colors.textDisabled : colors.textLight,
        }}
      >
        {suffix}
      </Text>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(s) => {
        // HH:MM フォーマットに簡易整形
        const cleaned = s.replace(/[^\d:]/g, "").slice(0, 5);
        onChange(cleaned);
      }}
      placeholder="09:00"
      placeholderTextColor={colors.textDisabled}
      style={styles.timeInput}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
    />
  );
}

function PresetEditor({
  presets,
  onChange,
}: {
  presets: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (
      DEFAULT_PURPOSE_PRESETS_MOBILE.includes(
        t as (typeof DEFAULT_PURPOSE_PRESETS_MOBILE)[number],
      ) ||
      presets.includes(t)
    ) {
      setDraft("");
      return;
    }
    onChange([...presets, t]);
    setDraft("");
  };

  const remove = (i: number) => {
    onChange(presets.filter((_, idx) => idx !== i));
  };

  const merged = useMemo(
    () => [...DEFAULT_PURPOSE_PRESETS_MOBILE, ...presets],
    [presets],
  );

  return (
    <View>
      <View style={styles.presetAddRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="例: 業界カンファレンス"
          placeholderTextColor={colors.textDisabled}
          style={[styles.input, { flex: 1 }]}
        />
        <TouchableOpacity
          onPress={add}
          style={styles.presetAddBtn}
          disabled={!draft.trim()}
        >
          <Feather
            name="plus"
            size={16}
            color={draft.trim() ? colors.text : colors.textDisabled}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.presetChipsWrap}>
        {merged.map((p, i) => {
          const isCustom = i >= DEFAULT_PURPOSE_PRESETS_MOBILE.length;
          const customIndex = i - DEFAULT_PURPOSE_PRESETS_MOBILE.length;
          return (
            <View
              key={p}
              style={[
                styles.presetChip,
                isCustom && {
                  backgroundColor: colors.infoBg,
                  borderColor: colors.primarySoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  isCustom && { color: colors.primary, fontWeight: "600" },
                ]}
              >
                {p}
              </Text>
              {isCustom && (
                <TouchableOpacity
                  onPress={() => remove(customIndex)}
                  hitSlop={6}
                >
                  <Feather name="x" size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { ...typography.bodyStrong, color: colors.text },
  cancel: { ...typography.body, color: colors.textMuted },
  save: { ...typography.bodyStrong, color: colors.primary },
  statusWrap: { width: 50, alignItems: "flex-end" },

  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 2,
    borderBottomColor: colors.primarySoft,
    marginTop: spacing[3],
    marginBottom: spacing[3],
  },
  sectionStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionStepText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  sectionHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTitle: { ...typography.bodyStrong, color: colors.text, marginBottom: 4 },
  cardHelper: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: spacing[3],
  },
  fieldLabel: {
    ...typography.captionStrong,
    color: colors.text,
    marginBottom: spacing[1],
  },
  input: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },

  placeMono: {
    ...typography.caption,
    color: colors.textLight,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  placeEmpty: {
    ...typography.caption,
    color: colors.warningText,
    marginTop: 2,
  },

  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  radioLabel: { ...typography.body, color: colors.text },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[2],
  },
  switchLabel: { ...typography.body, color: colors.text, flex: 1 },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
  },
  timeInput: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    width: 100,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  timeSeparator: { ...typography.body, color: colors.textMuted },

  numberInput: {
    minHeight: 36,
    width: 60,
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
    backgroundColor: colors.surface,
  },

  presetAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  presetAddBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  presetChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  presetChipText: {
    ...typography.caption,
    color: colors.textLight,
  },
});
