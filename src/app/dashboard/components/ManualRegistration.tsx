"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, CheckCircle, XCircle } from "lucide-react";
import type {
  AttributeDefinition,
  AttributeDefinitionCreate,
  AttributeValuePayload,
  FilterOption,
  MeasurementCreate,
  Sample,
  SoilProfile,
  VariableRead,
} from "@/app/services";
import {
  ApiError,
  dashboardService,
  eavService,
  measurementsService,
  samplesService,
  sitesService,
  variablesService,
} from "@/app/services";
import { normalizeCode } from "@/app/lib/normalizeCode";
import NewVariableModal from "./NewVariableModal";

// ── Shared helpers ────────────────────────────────────────────────────────────

const inputCls =
  "h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white";
const labelCls = "mb-1 block text-sm font-medium text-gray-700";
const cardCls = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";

const VALUE_TYPE_KEYS = ["numeric", "text", "boolean", "date"] as const;

const CATEGORY_SUGGESTIONS = ["topografia", "clima", "vegetacion", "admin", "riesgo", "teledeteccion", "sampling", "horizon", "lab_meta"];

const buildValuePayload = (valueType: string, raw: string, bool: boolean): AttributeValuePayload => {
  if (valueType === "boolean") return { value_boolean: bool };
  if (valueType === "date") return { value_date: raw || null };
  if (valueType === "numeric") return { value_numeric: raw === "" ? null : Number(raw) };
  return { value_text: raw || null };
};

function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-sm text-brand-800">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {ok}
      </p>
    );
  }
  return null;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback;

/** Shown in place of the create-attribute form when the user lacks catalog rights. */
function CatalogRestricted({ entity }: { entity: "sitio" | "muestra" | "perfil" }) {
  const t = useTranslations("upload.manual");
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
      {t.rich("catalogRestricted", {
        entity: t(`entity.${entity}`),
        b: (chunks) => <span className="font-medium text-gray-700">{chunks}</span>,
      })}
    </div>
  );
}

// ── Create-attribute form (reused for site / sample / profile) ────────────────

function AttributeCreateForm({
  title,
  units,
  onCreate,
}: {
  title: string;
  units: FilterOption[];
  onCreate: (payload: AttributeDefinitionCreate) => Promise<AttributeDefinition>;
}) {
  const t = useTranslations("upload.manual");
  const tv = useTranslations("upload.valueTypes");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [valueType, setValueType] = useState("numeric");
  const [unitId, setUnitId] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = normalizeCode(code || name);
    if (!name.trim() || !finalCode) {
      setError(t("attrForm.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const created = await onCreate({
        code: finalCode,
        name: name.trim(),
        value_type: valueType,
        default_unit_id: unitId ? Number(unitId) : null,
        category: category.trim() || null,
        description: description.trim() || null,
      });
      setOk(t("attrForm.created", { name: created.name, code: created.code }));
      setName("");
      setCode("");
      setCodeEdited(false);
      setCategory("");
      setDescription("");
    } catch (err) {
      setError(errorMessage(err, t("attrForm.createError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardCls}>
      <h4 className="mb-3 text-base font-semibold text-gray-900">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t("attrForm.name")}</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!codeEdited) setCode(normalizeCode(e.target.value));
            }}
            className={inputCls}
            placeholder={t("attrForm.namePlaceholder")}
          />
        </div>
        <div>
          <label className={labelCls}>{t("attrForm.code")}</label>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeEdited(true);
            }}
            className={`${inputCls} font-mono`}
            placeholder="PENDIENTE_PCT"
          />
        </div>
        <div>
          <label className={labelCls}>{t("attrForm.valueType")}</label>
          <select value={valueType} onChange={(e) => setValueType(e.target.value)} className={inputCls}>
            {VALUE_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {tv(key)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("attrForm.unit")}</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("attrForm.category")}</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="eav-categories" className={inputCls} />
          <datalist id="eav-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>{t("attrForm.description")}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Feedback error={error} ok={ok} />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("attrForm.create")}
        </button>
      </div>
    </form>
  );
}

// ── Site section ──────────────────────────────────────────────────────────────

function SiteSection({ units, projects, canManageCatalog }: { units: FilterOption[]; projects: FilterOption[]; canManageCatalog: boolean }) {
  const t = useTranslations("upload.manual");
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [projectId, setProjectId] = useState("");
  const [siteOptions, setSiteOptions] = useState<FilterOption[]>([]);
  const [siteId, setSiteId] = useState("");
  const [attributeId, setAttributeId] = useState("");
  const [raw, setRaw] = useState("");
  const [bool, setBool] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [confidence, setConfidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refreshAttributes = () => eavService.listSiteAttributes().then(setAttributes).catch(() => setAttributes([]));
  useEffect(() => {
    refreshAttributes();
  }, []);
  useEffect(() => {
    if (!projectId) {
      setSiteOptions([]);
      setSiteId("");
      return;
    }
    sitesService.getOptions(Number(projectId)).then(setSiteOptions).catch(() => setSiteOptions([]));
  }, [projectId]);

  const selectedAttr = attributes.find((a) => String(a.id) === attributeId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !attributeId || !selectedAttr) {
      setError(t("site.selectSiteAttr"));
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await eavService.createSiteAttributeValue({
        site_id: Number(siteId),
        site_attribute_id: Number(attributeId),
        ...buildValuePayload(selectedAttr.value_type, raw, bool),
        effective_date: effectiveDate || null,
        source_name: sourceName.trim() || null,
        confidence: confidence === "" ? null : Number(confidence),
      });
      setOk(t("site.registered"));
      setRaw("");
    } catch (err) {
      setError(errorMessage(err, t("registerError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {canManageCatalog ? (
        <AttributeCreateForm
          title={t("site.createTitle")}
          units={units}
          onCreate={async (p) => {
            const created = await eavService.createSiteAttribute(p);
            refreshAttributes();
            return created;
          }}
        />
      ) : (
        <CatalogRestricted entity="sitio" />
      )}

      <form onSubmit={submit} className={cardCls}>
        <h4 className="mb-3 text-base font-semibold text-gray-900">{t("site.registerTitle")}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("site.project")}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("site.site")}</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls} disabled={!projectId}>
              <option value="">{t("select")}</option>
              {siteOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("site.attribute")}</label>
            <select value={attributeId} onChange={(e) => setAttributeId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {attributes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.value_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("site.value")}</label>
            {selectedAttr?.value_type === "boolean" ? (
              <select value={bool ? "true" : "false"} onChange={(e) => setBool(e.target.value === "true")} className={inputCls}>
                <option value="true">{t("yes")}</option>
                <option value="false">{t("no")}</option>
              </select>
            ) : (
              <input
                type={selectedAttr?.value_type === "numeric" ? "number" : selectedAttr?.value_type === "date" ? "date" : "text"}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className={inputCls}
              />
            )}
          </div>
          <div>
            <label className={labelCls}>{t("site.effectiveDate")}</label>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("site.source")}</label>
            <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("site.confidence")}</label>
            <input type="number" step="0.01" min="0" max="1" value={confidence} onChange={(e) => setConfidence(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Feedback error={error} ok={ok} />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("registerValue")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Sample section ────────────────────────────────────────────────────────────

function SampleSection({ units, canManageCatalog }: { units: FilterOption[]; canManageCatalog: boolean }) {
  const t = useTranslations("upload.manual");
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [sampleId, setSampleId] = useState("");
  const [attributeId, setAttributeId] = useState("");
  const [raw, setRaw] = useState("");
  const [bool, setBool] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refreshAttributes = () => eavService.listSampleAttributes().then(setAttributes).catch(() => setAttributes([]));
  useEffect(() => {
    refreshAttributes();
  }, []);

  const selectedAttr = attributes.find((a) => String(a.id) === attributeId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleId || !attributeId || !selectedAttr) {
      setError(t("sample.idAttrRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await eavService.createSampleAttributeValue({
        sample_id: Number(sampleId),
        sample_attribute_id: Number(attributeId),
        ...buildValuePayload(selectedAttr.value_type, raw, bool),
      });
      setOk(t("sample.registered"));
      setRaw("");
    } catch (err) {
      setError(errorMessage(err, t("registerError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {canManageCatalog ? (
        <AttributeCreateForm
          title={t("sample.createTitle")}
          units={units}
          onCreate={async (p) => {
            const created = await eavService.createSampleAttribute(p);
            refreshAttributes();
            return created;
          }}
        />
      ) : (
        <CatalogRestricted entity="muestra" />
      )}

      <form onSubmit={submit} className={cardCls}>
        <h4 className="mb-1 text-base font-semibold text-gray-900">{t("sample.registerTitle")}</h4>
        <p className="mb-3 text-sm text-gray-500">{t("sample.registerHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("sample.sampleId")}</label>
            <input type="number" value={sampleId} onChange={(e) => setSampleId(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("sample.attribute")}</label>
            <select value={attributeId} onChange={(e) => setAttributeId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {attributes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.value_type})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("sample.value")}</label>
            {selectedAttr?.value_type === "boolean" ? (
              <select value={bool ? "true" : "false"} onChange={(e) => setBool(e.target.value === "true")} className={inputCls}>
                <option value="true">{t("yes")}</option>
                <option value="false">{t("no")}</option>
              </select>
            ) : (
              <input
                type={selectedAttr?.value_type === "numeric" ? "number" : selectedAttr?.value_type === "date" ? "date" : "text"}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className={inputCls}
              />
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Feedback error={error} ok={ok} />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("registerValue")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Soil profile section ──────────────────────────────────────────────────────

function ProfileSection({ units, projects, canManageCatalog }: { units: FilterOption[]; projects: FilterOption[]; canManageCatalog: boolean }) {
  const t = useTranslations("upload.manual");
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [profiles, setProfiles] = useState<SoilProfile[]>([]);

  // create-profile form
  const [projectId, setProjectId] = useState("");
  const [profileCode, setProfileCode] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  // value form
  const [valueProjectId, setValueProjectId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [attributeId, setAttributeId] = useState("");
  const [raw, setRaw] = useState("");
  const [bool, setBool] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refreshAttributes = () => eavService.listSoilProfileAttributes().then(setAttributes).catch(() => setAttributes([]));
  useEffect(() => {
    refreshAttributes();
  }, []);
  useEffect(() => {
    if (!valueProjectId) {
      setProfiles([]);
      setProfileId("");
      return;
    }
    eavService.listSoilProfiles(Number(valueProjectId)).then(setProfiles).catch(() => setProfiles([]));
  }, [valueProjectId]);

  const selectedAttr = attributes.find((a) => String(a.id) === attributeId);

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !profileCode.trim()) {
      setProfileError(t("profile.projectCodeRequired"));
      return;
    }
    setCreatingProfile(true);
    setProfileError(null);
    setProfileOk(null);
    try {
      const created = await eavService.createSoilProfile({ project_id: Number(projectId), profile_code: profileCode.trim() });
      setProfileOk(t("profile.profileCreated", { code: created.profile_code }));
      setProfileCode("");
      if (String(created.project_id) === valueProjectId) {
        eavService.listSoilProfiles(Number(valueProjectId)).then(setProfiles).catch(() => undefined);
      }
    } catch (err) {
      setProfileError(errorMessage(err, t("profile.createProfileError")));
    } finally {
      setCreatingProfile(false);
    }
  };

  const submitValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || !attributeId || !selectedAttr) {
      setError(t("profile.selectProfileAttr"));
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await eavService.createSoilProfileAttributeValue({
        soil_profile_id: Number(profileId),
        soil_profile_attribute_id: Number(attributeId),
        ...buildValuePayload(selectedAttr.value_type, raw, bool),
      });
      setOk(t("profile.registered"));
      setRaw("");
    } catch (err) {
      setError(errorMessage(err, t("registerError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={createProfile} className={cardCls}>
        <h4 className="mb-3 text-base font-semibold text-gray-900">{t("profile.createProfileTitle")}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("profile.project")}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("profile.profileCode")}</label>
            <input value={profileCode} onChange={(e) => setProfileCode(e.target.value)} className={`${inputCls} font-mono`} placeholder="PERFIL_001" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Feedback error={profileError} ok={profileOk} />
          <button type="submit" disabled={creatingProfile} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40">
            {creatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("profile.createProfile")}
          </button>
        </div>
      </form>

      {canManageCatalog ? (
        <AttributeCreateForm
          title={t("profile.createAttrTitle")}
          units={units}
          onCreate={async (p) => {
            const created = await eavService.createSoilProfileAttribute(p);
            refreshAttributes();
            return created;
          }}
        />
      ) : (
        <CatalogRestricted entity="perfil" />
      )}

      <form onSubmit={submitValue} className={cardCls}>
        <h4 className="mb-3 text-base font-semibold text-gray-900">{t("profile.registerTitle")}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("profile.project")}</label>
            <select value={valueProjectId} onChange={(e) => setValueProjectId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("profile.profile")}</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputCls} disabled={!valueProjectId}>
              <option value="">{t("select")}</option>
              {profiles.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.profile_code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("profile.attribute")}</label>
            <select value={attributeId} onChange={(e) => setAttributeId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {attributes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.value_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("profile.value")}</label>
            {selectedAttr?.value_type === "boolean" ? (
              <select value={bool ? "true" : "false"} onChange={(e) => setBool(e.target.value === "true")} className={inputCls}>
                <option value="true">{t("yes")}</option>
                <option value="false">{t("no")}</option>
              </select>
            ) : (
              <input
                type={selectedAttr?.value_type === "numeric" ? "number" : selectedAttr?.value_type === "date" ? "date" : "text"}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className={inputCls}
              />
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Feedback error={error} ok={ok} />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("registerValue")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Measurements ──────────────────────────────────────────────────────────────

/**
 * What a dataset is made of: the value of one variable in one sample. The sample is found by
 * walking project → site → sample (nobody knows a sample's database id), and a variable that is
 * not in the catalogue yet can be added from here by whoever manages the catalogue.
 */
function MeasurementSection({
  projects,
  units,
  canManageCatalog,
}: {
  projects: FilterOption[];
  units: FilterOption[];
  canManageCatalog: boolean;
}) {
  const t = useTranslations("upload.manual");
  const [variables, setVariables] = useState<VariableRead[]>([]);
  const [sites, setSites] = useState<FilterOption[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [variableId, setVariableId] = useState("");
  const [search, setSearch] = useState("");
  const [unitId, setUnitId] = useState("");
  const [raw, setRaw] = useState("");
  const [bool, setBool] = useState(false);
  const [showNewVariable, setShowNewVariable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const variableName = (v: VariableRead) => v.label ?? v.name ?? v.variable_code;
  const loadVariables = () => variablesService.getAll().then(setVariables).catch(() => setVariables([]));
  useEffect(() => {
    void loadVariables();
  }, []);

  // project -> sites -> samples: each choice resets what depends on it
  useEffect(() => {
    setSiteId("");
    setSampleId("");
    setSites([]);
    if (!projectId) return;
    sitesService.getOptions(Number(projectId)).then(setSites).catch(() => setSites([]));
  }, [projectId]);
  useEffect(() => {
    setSampleId("");
    setSamples([]);
    if (!siteId) return;
    samplesService.getAll({ site_id: Number(siteId), limit: 100 }).then(setSamples).catch(() => setSamples([]));
  }, [siteId]);

  const selectedVar = variables.find((v) => String(v.id) === variableId);
  const valueType = ["numeric", "text", "boolean", "date"].includes(selectedVar?.value_type ?? "")
    ? (selectedVar?.value_type as string)
    : "text";

  const q = search.trim().toLowerCase();
  const visibleVariables = variables.filter(
    (v) => !q || [variableName(v), v.variable_code, v.matrix ?? ""].some((x) => x.toLowerCase().includes(q)),
  );

  const pickVariable = (id: string) => {
    setVariableId(id);
    setRaw("");
    // the variable's usual unit is the one to offer first
    const v = variables.find((x) => String(x.id) === id);
    setUnitId(v?.default_unit_id ? String(v.default_unit_id) : "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    if (!sampleId || !selectedVar) {
      setError(t("measurement.required"));
      return;
    }
    const payload: MeasurementCreate = {
      sample_id: Number(sampleId),
      variable_id: selectedVar.id,
      unit_id: unitId ? Number(unitId) : null,
    };
    if (valueType === "boolean") payload.value_boolean = bool;
    else if (valueType === "numeric") {
      const n = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(n)) {
        setError(t("measurement.numberRequired"));
        return;
      }
      payload.value_numeric = n;
    } else if (valueType === "date") {
      if (!raw) {
        setError(t("measurement.valueRequired"));
        return;
      }
      payload.value_date = raw;
    } else {
      if (!raw.trim()) {
        setError(t("measurement.valueRequired"));
        return;
      }
      payload.value_text = raw.trim();
    }
    setBusy(true);
    setError(null);
    try {
      await measurementsService.create(payload);
      setOk(t("measurement.registered"));
      setRaw(""); // the sample stays chosen: the next measurement is usually of the same one
    } catch (err) {
      setError(errorMessage(err, t("measurement.registerError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {canManageCatalog ? (
        <div className={`${cardCls} flex flex-wrap items-center justify-between gap-3`}>
          <div className="min-w-0">
            <h4 className="text-base font-semibold text-gray-900">{t("measurement.createVariableTitle")}</h4>
            <p className="text-sm text-gray-500">{t("measurement.createVariableBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewVariable(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
          >
            <Plus className="h-4 w-4" />
            {t("measurement.newVariable")}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          {t("measurement.variablesRestricted")}
        </div>
      )}

      <form onSubmit={submit} className={cardCls}>
        <h4 className="mb-1 text-base font-semibold text-gray-900">{t("measurement.registerTitle")}</h4>
        <p className="mb-3 text-sm text-gray-500">{t("measurement.registerHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("profile.project")}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("measurement.site")}</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls} disabled={!projectId}>
              <option value="">{t("select")}</option>
              {sites.map((si) => (
                <option key={si.id} value={si.id}>
                  {si.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("measurement.sample")}</label>
            <select value={sampleId} onChange={(e) => setSampleId(e.target.value)} className={inputCls} disabled={!siteId}>
              <option value="">{siteId && samples.length === 0 ? t("measurement.noSamples") : t("select")}</option>
              {samples.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.sample_code}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>{t("measurement.variable")}</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("measurement.variableSearch")}
              className={`${inputCls} mb-2`}
            />
            <select value={variableId} onChange={(e) => pickVariable(e.target.value)} className={inputCls}>
              <option value="">{t("select")}</option>
              {visibleVariables.map((v) => (
                <option key={v.id} value={v.id}>
                  {variableName(v)}
                  {v.matrix ? ` — ${v.matrix}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t("measurement.value")}</label>
            {valueType === "boolean" ? (
              <select value={bool ? "true" : "false"} onChange={(e) => setBool(e.target.value === "true")} className={inputCls}>
                <option value="true">{t("yes")}</option>
                <option value="false">{t("no")}</option>
              </select>
            ) : (
              <input
                type={valueType === "numeric" ? "number" : valueType === "date" ? "date" : "text"}
                step={valueType === "numeric" ? "any" : undefined}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className={inputCls}
                disabled={!selectedVar}
              />
            )}
          </div>
          <div>
            <label className={labelCls}>{t("measurement.unit")}</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls} disabled={!selectedVar || valueType === "boolean"}>
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Feedback error={error} ok={ok} />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("measurement.register")}
          </button>
        </div>
      </form>

      {canManageCatalog && showNewVariable ? (
        <NewVariableModal
          onClose={() => setShowNewVariable(false)}
          onCreated={async (id) => {
            setShowNewVariable(false);
            await loadVariables();
            setSearch("");
            pickVariable(String(id));
          }}
        />
      ) : null}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type EntityTab = "sitio" | "muestra" | "perfil" | "medicion";

const ENTITY_TAB_KEYS: EntityTab[] = ["sitio", "muestra", "perfil", "medicion"];

export default function ManualRegistration({ canManageCatalog }: { canManageCatalog: boolean }) {
  const t = useTranslations("upload.manual");
  const [tab, setTab] = useState<EntityTab>("sitio");
  const [units, setUnits] = useState<FilterOption[]>([]);
  const [projects, setProjects] = useState<FilterOption[]>([]);

  useEffect(() => {
    variablesService.getUnits().then(setUnits).catch(() => setUnits([]));
    dashboardService.getProjectsOptions().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        {ENTITY_TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === key ? "bg-gray-100 text-gray-900 shadow-sm" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "sitio" && <SiteSection units={units} projects={projects} canManageCatalog={canManageCatalog} />}
      {tab === "muestra" && <SampleSection units={units} canManageCatalog={canManageCatalog} />}
      {tab === "perfil" && <ProfileSection units={units} projects={projects} canManageCatalog={canManageCatalog} />}
      {tab === "medicion" && <MeasurementSection units={units} projects={projects} canManageCatalog={canManageCatalog} />}
    </div>
  );
}
