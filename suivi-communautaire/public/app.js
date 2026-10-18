(() => {
  const nodes = () => [...document.querySelectorAll("[data-case-id]")];
  const gated = () => [...document.querySelectorAll("[data-requires-supervisor]")];
  if (!nodes().length && !gated().length) return;
  let generation = 0;
  let controller;
  let terminal = false;
  const status = document.getElementById("access-status");
  const message = document.getElementById("access-message");
  function hide() {
    generation++;
    controller?.abort();
    document.documentElement.classList.add("checking");
  }
  function notice(text) {
    if (status && message) {
      message.textContent = text;
      status.hidden = false;
    }
  }
  async function verify() {
    if (terminal || document.hidden) return;
    const mine = ++generation;
    controller?.abort();
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), 4000);
    try {
      const body = new URLSearchParams();
      nodes().forEach((n) => body.append("ids[]", n.dataset.caseId));
      const res = await fetch("/acces", {
        method: "POST",
        body,
        cache: "no-store",
        signal: controller.signal,
      });
      if (mine !== generation) return;
      if (!res.ok) throw new Error("access");
      const data = await res.json();
      if (mine !== generation) return;
      if (!Array.isArray(data.allowed)) throw new Error("access");
      let removed = false;
      nodes().forEach((n) => {
        if (!data.allowed.includes(n.dataset.caseId)) {
          n.remove();
          removed = true;
        }
      });
      // Pages d'administration des modèles : retirées dès que le rôle superviseur disparaît.
      gated().forEach((n) => {
        if (data.supervisor !== true) {
          n.remove();
          removed = true;
        }
      });
      // Journal des accès : permission audit:view revérifiée pour l'organisme initial de l'écran.
      for (const n of [...document.querySelectorAll("[data-audit-org]")]) {
        const res2 = await fetch("/audit/acces", {
          method: "POST",
          body: new URLSearchParams({ organisation: n.dataset.auditOrg }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (mine !== generation) return;
        if (!res2.ok) throw new Error("access");
        const data2 = await res2.json();
        if (mine !== generation) return;
        if (data2.allowed !== true) {
          n.remove();
          removed = true;
        }
      }
      if (removed) {
        document
          .querySelectorAll("[data-private-count]")
          .forEach((n) => n.remove());
        notice(
          "Ce contenu n’est plus accessible. Il a été retiré de cet écran.",
        );
      } else if (status && !status.dataset.revoked) status.hidden = true;
      if (removed && status) status.dataset.revoked = "true";
      document.documentElement.classList.remove("checking");
      if (!nodes().length && !gated().length) terminal = true;
    } catch {
      if (mine !== generation) return;
      document.documentElement.classList.add("checking");
      notice(
        "Vérification des accès impossible. Les dossiers sont masqués jusqu’au rétablissement de la connexion.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  document.addEventListener("visibilitychange", () => {
    hide();
    if (!document.hidden) verify();
  });
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", () => {
    hide();
    verify();
  });
  window.addEventListener("focus", () => {
    hide();
    verify();
  });
  window.addEventListener("offline", () => {
    hide();
    notice("Connexion interrompue. Les dossiers sont masqués.");
  });
  window.addEventListener("online", verify);
  setInterval(verify, 5000);
  hide();
  verify();
})();

// Saisie d'une note : le fuseau et l'instant du navigateur sont proposés, visibles et modifiables.
(() => {
  const tz = document.getElementById("f-tz");
  const date = document.getElementById("f-date");
  const time = document.getElementById("f-time");
  if (!tz || !date || !time || document.querySelector(".field-error")) return;
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) tz.value = zone;
  } catch {}
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  if (!date.value)
    date.value = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate());
  if (!time.value) time.value = p(now.getHours()) + ":" + p(now.getMinutes());
})();
