"use client";
import { useActionState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deleteMenuItem, importMenuCsv, saveMenuItem, type ActionState } from "../../actions";
import { FormStatus } from "@/components/form-status";
import { formatUsd } from "@/lib/pricing";

export interface EditorItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  position: number;
  is_available: boolean;
  dish: { name_es: string; name_en: string } | null;
}

export function MenuEditor({ restaurantId, items, categories }: { restaurantId: string; items: EditorItem[]; categories: string[] }) {
  const t = useTranslations("panel.menu");
  return (
    <div className="space-y-6">
      <p className="text-muted">{t("intro")}</p>
      <datalist id="menu-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t("add")}</h2>
        <ItemForm restaurantId={restaurantId} item={null} />
      </section>

      <section>
        {items.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("empty")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {items.map((item) => (
              <ItemRow key={item.id} restaurantId={restaurantId} item={item} />
            ))}
          </ul>
        )}
      </section>

      <ImportForm restaurantId={restaurantId} />
    </div>
  );
}

function ItemRow({ restaurantId, item }: { restaurantId: string; item: EditorItem }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className={`font-medium ${item.is_available ? "" : "text-muted line-through"}`}>{item.name}</p>
            <p className="flex flex-wrap gap-x-2 text-xs text-muted">
              {item.category && <span>{item.category}</span>}
              {item.dish && (
                <span className="text-sea">{t("menu.dishTag", { dish: locale === "en" ? item.dish.name_en : item.dish.name_es })}</span>
              )}
            </p>
          </div>
          <span className="shrink-0 tabular-nums">{formatUsd(item.price, locale)}</span>
          <span className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
        </summary>
        <div className="border-t border-line bg-surface-2/50 px-4 pb-4">
          <ItemForm restaurantId={restaurantId} item={item} />
          <form
            action={deleteMenuItem.bind(null, restaurantId, item.id)}
            onSubmit={(e) => {
              if (!confirm(t("confirmDelete"))) e.preventDefault();
            }}
            className="mt-2"
          >
            <button className="text-sm font-medium text-danger hover:underline">{t("delete")}</button>
          </form>
        </div>
      </details>
    </li>
  );
}

function ItemForm({ restaurantId, item }: { restaurantId: string; item: EditorItem | null }) {
  const t = useTranslations("panel");
  const tm = useTranslations("panel.menu");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveMenuItem.bind(null, restaurantId, item?.id ?? null), {});
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = item?.id ?? "new";

  // Clear the "add" form after a successful insert.
  useEffect(() => {
    if (state.ok && !item) formRef.current?.reset();
  }, [state, item]);

  return (
    <form ref={formRef} action={action} className="mt-3 grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <label htmlFor={`${prefix}-name`} className="label">{tm("name")}</label>
        <input id={`${prefix}-name`} name="name" defaultValue={item?.name} required maxLength={160} className="input" />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor={`${prefix}-price`} className="label">{tm("price")}</label>
        <input id={`${prefix}-price`} name="price" defaultValue={item?.price ?? ""} inputMode="decimal" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-category`} className="label">{tm("category")}</label>
        <input id={`${prefix}-category`} name="category" defaultValue={item?.category ?? ""} list="menu-categories" placeholder={tm("categoryPlaceholder")} maxLength={60} className="input" />
      </div>
      <div className="sm:col-span-5">
        <label htmlFor={`${prefix}-description`} className="label">{tm("description")}</label>
        <input id={`${prefix}-description`} name="description" defaultValue={item?.description ?? ""} maxLength={500} className="input" />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor={`${prefix}-position`} className="label">{tm("position")}</label>
        <input id={`${prefix}-position`} name="position" type="number" min={0} defaultValue={item?.position ?? ""} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
        {item && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_available" defaultChecked={item.is_available} className="h-4 w-4 accent-[var(--brand)]" />
            {tm("available")}
          </label>
        )}
        <button className="btn-primary" disabled={pending}>{item ? t("save") : tm("add")}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function ImportForm({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("panel.menu");
  const [state, action, pending] = useActionState<ActionState, FormData>(importMenuCsv.bind(null, restaurantId), {});
  return (
    <details className="card p-5 sm:p-6">
      <summary className="cursor-pointer font-semibold">{t("importTitle")}</summary>
      <form action={action} className="mt-3 space-y-3">
        <p className="hint mt-0">{t("importHint")}</p>
        <input name="csv" type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sea-soft file:px-4 file:py-2 file:font-semibold file:text-sea" />
        <textarea name="csvText" rows={4} className="input font-mono text-xs" placeholder={"nombre,descripcion,precio,categoria\nMofongo de pollo,Con caldo,14.95,Platos"} />
        <div className="flex items-center gap-3">
          <button className="btn-secondary" disabled={pending}>{t("importButton")}</button>
          {state.ok && <p role="status" className="text-sm font-medium text-ok">✓ {t("imported", { count: state.count ?? 0 })}</p>}
          {state.error && <p role="alert" className="text-sm font-medium text-danger">{t("importError")}</p>}
        </div>
      </form>
    </details>
  );
}
