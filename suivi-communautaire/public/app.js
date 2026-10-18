(() => {
  const nodes = () => [...document.querySelectorAll("[data-case-id]")];
  if (!nodes().length) return;
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
      if (removed) {
        document
          .querySelectorAll("[data-private-count]")
          .forEach((n) => n.remove());
        notice(
          "Un dossier n’est plus accessible. Son contenu a été retiré de cet écran.",
        );
      } else if (status && !status.dataset.revoked) status.hidden = true;
      if (removed && status) status.dataset.revoked = "true";
      document.documentElement.classList.remove("checking");
      if (!nodes().length) terminal = true;
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
