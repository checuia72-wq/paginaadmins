import { useEffect } from "react";
import { getMenusActivosPorRestaurante, type RestauranteMenuItem } from "../../services/restauranteMenu.service";
import "../../styles/control-operativo-meals.css";

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

function findFieldLabel(text: string): HTMLLabelElement | null {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const needle = normalize(text);
  return labels.find((label) => normalize(label.textContent).startsWith(needle)) ?? null;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ControlOperativoMealSelector() {
  useEffect(() => {
    let disposed = false;
    let lastRestaurant = "";
    let lastLunchEnabled: boolean | null = null;
    const menuCache = new Map<string, RestauranteMenuItem[]>();

    const renderSelector = async () => {
      if (disposed) return;

      const mealLabel = findFieldLabel("Tipo almuerzo");
      const restaurantLabel = findFieldLabel("Restaurante");
      const includesLunchLabel = findFieldLabel("Incluye almuerzo");
      const input = mealLabel?.querySelector<HTMLInputElement>("input");
      const restaurantSelect = restaurantLabel?.querySelector<HTMLSelectElement>("select");
      const includesLunchSelect = includesLunchLabel?.querySelector<HTMLSelectElement>("select");

      if (!mealLabel || !input || !restaurantSelect) {
        lastRestaurant = "";
        lastLunchEnabled = null;
        return;
      }

      const existing = mealLabel.querySelector<HTMLSelectElement>("select[data-restaurant-meal-selector='true']");
      const restaurant = restaurantSelect.value.trim();
      const lunchEnabled = !includesLunchSelect || ["si", "sí"].includes(normalize(includesLunchSelect.value));

      if (restaurant === lastRestaurant && lunchEnabled === lastLunchEnabled && existing) {
        if (existing.value !== input.value && input.value) existing.value = input.value;
        return;
      }

      lastRestaurant = restaurant;
      lastLunchEnabled = lunchEnabled;

      if (!restaurant || !lunchEnabled) {
        existing?.remove();
        input.hidden = false;
        input.disabled = !lunchEnabled;
        input.placeholder = lunchEnabled ? "Selecciona primero un restaurante" : "No aplica";
        return;
      }

      const cacheKey = normalize(restaurant);
      let menus = menuCache.get(cacheKey);
      if (!menus) {
        menus = await getMenusActivosPorRestaurante(restaurant);
        menuCache.set(cacheKey, menus);
      }
      if (disposed) return;

      if (!menus.length) {
        existing?.remove();
        input.hidden = false;
        input.disabled = false;
        input.placeholder = `Sin menú configurado para ${restaurant}`;
        return;
      }

      const select = existing ?? document.createElement("select");
      select.dataset.restaurantMealSelector = "true";
      select.className = "op-restaurant-meal-select";
      select.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Seleccionar tipo de almuerzo";
      select.appendChild(placeholder);

      menus.forEach((menu) => {
        const option = document.createElement("option");
        option.value = menu.nombre_plato;
        option.textContent = menu.nombre_plato;
        if (menu.descripcion) option.title = menu.descripcion;
        select.appendChild(option);
      });

      const currentValue = input.value.trim();
      const matching = menus.find((menu) => normalize(menu.nombre_plato) === normalize(currentValue));
      select.value = matching?.nombre_plato ?? "";
      select.onchange = () => setReactInputValue(input, select.value);

      if (!existing) mealLabel.appendChild(select);
      input.hidden = true;
      input.disabled = false;
    };

    const timer = window.setInterval(() => {
      void renderSelector();
    }, 350);
    void renderSelector();

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
