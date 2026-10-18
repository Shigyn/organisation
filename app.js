/* Organisation LocWeb — agenda, clients, taches, paiements (2026-10-18).
   Une seule page. Les donnees vivent dans la fonction org-perso (dossier prive
   Supabase) ; une copie reste dans le navigateur pour s'ouvrir hors reseau. */
(function () {
  'use strict';
  var API = 'https://ibqawtgnucakzdldnitj.supabase.co/functions/v1/org-perso';
  var app = document.getElementById('app');
  var jeton = lire('org-jeton');
  var D = null;                       // { clients, rdv, taches, paiements }
  var vue = { filtreClient: 'actifs', recherche: '', filtrePaiement: 'attendu', mois: null, jour: null, tachesFaites: false };

  /* ---------------- outils ---------------- */
  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function p2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function jourDe(s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2] || 1); }
  function plusJours(s, n) { var d = jourDe(s); d.setDate(d.getDate() + n); return ymd(d); }
  function auj() { return ymd(new Date()); }
  function uid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  var FMT_JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  var FMT_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  var FMT_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  function quand(s) {
    if (!s) return '';
    var t = auj();
    if (s === t) return 'aujourd’hui';
    if (s === plusJours(t, 1)) return 'demain';
    if (s === plusJours(t, -1)) return 'hier';
    return FMT_JOUR.format(jourDe(s));
  }
  function euros(c) { return ((c || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: (c || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
  function centimes(v) { var n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : Math.round(n * 100); }
  function enEuros(c) { return c ? String(c / 100).replace('.', ',') : ''; }
  function client(id) { return (D.clients || []).find(function (c) { return c.id === id; }); }
  function nomClient(id) { var c = client(id); return c ? c.nom : ''; }
  function tri(l, f) { return l.slice().sort(function (a, b) { var x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; }); }

  var STATUTS = [
    { v: 'prospect', l: 'Prospect', c: 'p-bleu' },
    { v: 'apercu', l: 'Aperçu envoyé', c: 'p-bleu' },
    { v: 'devis', l: 'Devis envoyé', c: 'p-ambre' },
    { v: 'signe', l: 'Signé', c: 'p-vert' },
    { v: 'en_ligne', l: 'En ligne', c: 'p-vert' },
    { v: 'relance', l: 'À relancer', c: 'p-ambre' },
    { v: 'perdu', l: 'Perdu', c: '' },
  ];
  function statut(v) { return STATUTS.find(function (s) { return s.v === v; }) || STATUTS[0]; }
  function pastilleStatut(v) { var s = statut(v); return '<span class="pastille ' + s.c + '">' + esc(s.l) + '</span>'; }
  var MODES = ['Virement', 'Espèces', 'Carte / Stripe', 'Chèque', 'Autre'];

  var I = {
    jour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/></svg>',
    taches: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.3 2.7 2.7L16 9.5"/></svg>',
    argent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12.5" rx="2.5"/><circle cx="12" cy="12.25" r="2.6"/><path d="M6 9.5v.01M18 15v.01"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3.5h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6.5 6.5l1.5-2.3 4.5 1.8V19a2 2 0 0 1-2 2C10.6 21 3 13.4 3 5.5a2 2 0 0 1 2-2Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
    lieu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    lien: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
    fichier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>',
    retour: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
    droite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l1.3-4A8.5 8.5 0 1 1 8.4 19Z"/></svg>',
  };

  /* ---------------- serveur ---------------- */
  function appel(action, extra) {
    var corps = Object.assign({ action: action, jeton: jeton }, extra || {});
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && action !== 'connexion') { deconnecter(); throw new Error(j.refus || 'Reconnecte-toi.'); }
          if (!r.ok) throw new Error(j.refus || j.error || 'Le serveur ne répond pas.');
          return j;
        });
      }, function () { throw new Error('Pas de connexion internet.'); });
  }
  function charger() {
    return appel('lire').then(function (r) {
      D = r.donnees; ecrire('org-cache', JSON.stringify(D)); rendre();
    }).catch(function (e) {
      if (!jeton) return;
      var c = lire('org-cache');
      if (c && !D) { D = JSON.parse(c); rendre(); }
      toast(e.message + (c ? ' Affichage de la dernière copie.' : ''), true);
    });
  }
  function enregistrer(rubrique, el, message) {
    var l = D[rubrique], i = l.findIndex(function (x) { return x.id === el.id; });
    if (i >= 0) l[i] = el; else l.push(el);
    ecrire('org-cache', JSON.stringify(D)); rendre();
    return appel('enregistrer', { rubrique: rubrique, element: el })
      .then(function () { toast(message || 'Enregistré'); })
      .catch(function (e) { toast(e.message, true); charger(); });
  }
  function supprimer(rubrique, id, message) {
    D[rubrique] = D[rubrique].filter(function (x) { return x.id !== id; });
    ecrire('org-cache', JSON.stringify(D)); rendre();
    return appel('supprimer', { rubrique: rubrique, id: id })
      .then(function () { toast(message || 'Supprimé'); })
      .catch(function (e) { toast(e.message, true); charger(); });
  }
  function deconnecter() { jeton = null; D = null; ecrire('org-jeton', null); ecrire('org-cache', null); rendre(); }

  var minuterie;
  function toast(t, erreur) {
    var el = document.getElementById('toast');
    el.textContent = t; el.className = 'toast' + (erreur ? ' erreur' : ''); el.hidden = false;
    clearTimeout(minuterie); minuterie = setTimeout(function () { el.hidden = true; }, erreur ? 5000 : 2200);
  }

  /* ---------------- rendu ---------------- */
  function route() { return (location.hash.replace(/^#\/?/, '') || 'aujourdhui').split('/'); }
  function rendre() {
    if (!jeton) { app.innerHTML = ecranConnexion(); var c = app.querySelector('input'); if (c) c.focus(); return; }
    if (!D) { app.innerHTML = '<div class="chargement">Chargement…</div>'; return; }
    var r = route(), page = r[0], html;
    if (page === 'calendrier') html = ecranCalendrier();
    else if (page === 'clients') html = ecranClients();
    else if (page === 'client') html = ecranFiche(r[1]);
    else if (page === 'taches') html = ecranTaches();
    else if (page === 'paiements') html = ecranPaiements();
    else { page = 'aujourdhui'; html = ecranAujourdhui(); }
    var y = window.scrollY;
    app.innerHTML = '<div class="cadre">' + menu(page === 'client' ? 'clients' : page) + '<main>' + html + '</main></div>';
    window.scrollTo(0, y);
  }

  function ecranConnexion() {
    return '<div class="connexion"><form data-form="connexion">' +
      '<img src="icone-192.png" alt=""><h1>Organisation</h1><p>Ton agenda, tes clients et tes paiements.</p>' +
      '<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Code" aria-label="Code à 8 chiffres" required>' +
      '<button class="btn btn-rouge" type="submit">Ouvrir</button></form></div>';
  }

  function aFaireMoi() { return D.taches.filter(function (t) { return !t.fait && t.qui !== 'client'; }); }
  function enRetard() { var t = auj(); return D.paiements.filter(function (p) { return p.statut !== 'paye' && p.echeance && p.echeance < t; }); }

  function menu(actif) {
    var nbT = aFaireMoi().filter(function (t) { return t.echeance && t.echeance <= auj(); }).length;
    var nbR = enRetard().length;
    function o(id, ico, l, n) {
      return '<a class="onglet' + (actif === id ? ' actif' : '') + '" href="#' + id + '">' + I[ico] + '<span>' + l + '</span>' + (n ? '<span class="pastille p-rouge">' + n + '</span>' : '') + '</a>';
    }
    var theme = lire('org-theme') || 'auto';
    return '<nav class="menu" aria-label="Rubriques"><div class="marque"><img src="icone-192.png" alt="">Organisation</div>' +
      o('aujourdhui', 'jour', 'Aujourd’hui') + o('calendrier', 'cal', 'Calendrier') + o('clients', 'clients', 'Clients') +
      o('taches', 'taches', 'Tâches', nbT) + o('paiements', 'argent', 'Paiements', nbR) +
      '<div class="menu-pied"><button type="button" data-act="theme">Thème : ' + { auto: 'automatique', light: 'clair', dark: 'sombre' }[theme] + '</button>' +
      '<button type="button" data-act="actualiser">Actualiser</button><button type="button" data-act="deconnexion">Se déconnecter</button></div></nav>';
  }

  /* ----- lignes communes ----- */
  function ligneRdv(r, avecJour) {
    var c = client(r.client);
    return '<div class="ligne cliquable" data-act="rdv" data-id="' + r.id + '">' +
      (avecJour ? '<div class="jour-rdv"><small>' + esc(FMT_JOUR.format(jourDe(r.date)).split(' ')[0]) + '</small><b>' + jourDe(r.date).getDate() + '</b></div>' : '') +
      '<div class="heure">' + esc(r.heure || '—') + '</div>' +
      '<div class="ligne-corps"><b>' + esc(r.titre) + '</b><span>' + esc([c && c.nom, r.lieu].filter(Boolean).join(' · ')) + '</span></div></div>';
  }
  function ligneTache(t) {
    var retard = !t.fait && t.echeance && t.echeance < auj();
    return '<div class="ligne' + (t.fait ? ' faite' : '') + '"><label class="case"><input type="checkbox" data-act="cocher" data-id="' + t.id + '"' + (t.fait ? ' checked' : '') + ' aria-label="Fait"></label>' +
      '<div class="ligne-corps cliquable" data-act="tache" data-id="' + t.id + '" style="cursor:pointer"><b>' + esc(t.titre) + '</b><span>' + esc([nomClient(t.client), t.qui === 'client' ? 'en attente du client' : ''].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="ligne-fin">' + (t.echeance ? '<span class="pastille' + (retard ? ' p-rouge' : t.echeance === auj() ? ' p-ambre' : '') + '">' + esc(quand(t.echeance)) + '</span>' : '') + '</div></div>';
  }
  function lignePaiement(p) {
    var paye = p.statut === 'paye', retard = !paye && p.echeance && p.echeance < auj();
    return '<div class="ligne"><div class="ligne-corps cliquable" data-act="paiement" data-id="' + p.id + '" style="cursor:pointer"><b>' + esc(nomClient(p.client) || p.libelle) + '</b><span>' +
      esc([nomClient(p.client) ? p.libelle : '', paye ? 'payé ' + quand(p.payeLe) + (p.mode ? ' · ' + p.mode : '') : p.echeance ? 'échéance ' + quand(p.echeance) : 'sans échéance'].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="ligne-fin"><span class="montant">' + euros(p.montant) + '</span>' +
      (paye ? '<span class="pastille p-vert">Payé</span>' : (retard ? '<span class="pastille p-rouge">En retard</span>' : '') + '<button class="btn btn-petit" type="button" data-act="encaisser" data-id="' + p.id + '">Encaissé</button>') + '</div></div>';
  }
  function bloc(titre, nb, contenu, bouton) {
    return '<section class="bloc"><div class="bloc-tete"><h2>' + titre + (nb != null ? '<small>' + nb + '</small>' : '') + '</h2>' + (bouton || '') + '</div><div class="liste">' + contenu + '</div></section>';
  }
  function vide(t) { return '<p class="vide">' + t + '</p>'; }
  function btnAjout(act, l, extra) { return '<button class="btn btn-petit" type="button" data-act="' + act + '"' + (extra || '') + '>' + I.plus + ' ' + l + '</button>'; }

  /* ----- Aujourd'hui ----- */
  function ecranAujourdhui() {
    var t = auj(), d7 = plusJours(t, 7), mois = t.slice(0, 7);
    var rdv = tri(D.rdv.filter(function (r) { return r.date >= t && r.date <= d7; }), function (r) { return r.date + (r.heure || ''); });
    var taches = tri(aFaireMoi(), function (x) { return x.echeance || '9999'; });
    var attente = D.taches.filter(function (x) { return !x.fait && x.qui === 'client'; });
    var relances = tri(D.clients.filter(function (c) { return c.relance && c.relance <= plusJours(t, 7) && c.statut !== 'perdu'; }), function (c) { return c.relance; });
    var aEnc = D.paiements.filter(function (p) { return p.statut !== 'paye'; });
    var retard = enRetard();
    var encMois = D.paiements.filter(function (p) { return p.statut === 'paye' && (p.payeLe || '').slice(0, 7) === mois; });
    var somme = function (l) { return l.reduce(function (s, p) { return s + (p.montant || 0); }, 0); };
    var urgentes = taches.filter(function (x) { return x.echeance && x.echeance <= t; }).length;

    var titre = FMT_LONG.format(new Date());
    return '<div class="tete"><div><h1>' + esc(titre.charAt(0).toUpperCase() + titre.slice(1)) + '</h1><p class="sous">' +
      (rdv.filter(function (r) { return r.date === t; }).length ? rdv.filter(function (r) { return r.date === t; }).length + ' rendez-vous aujourd’hui' : 'Pas de rendez-vous aujourd’hui') +
      (urgentes ? ' · ' + urgentes + ' tâche' + (urgentes > 1 ? 's' : '') + ' pour aujourd’hui' : '') + '</p></div>' +
      '<div class="actions">' + btnAjout('nouveau-rdv', 'Rendez-vous') + btnAjout('nouvelle-tache', 'Tâche') + '</div></div>' +
      '<div class="chiffres">' +
      '<a class="chiffre" href="#paiements"><small>À encaisser</small><b>' + euros(somme(aEnc)) + '</b><span>' + aEnc.length + ' paiement' + (aEnc.length > 1 ? 's' : '') + '</span></a>' +
      '<a class="chiffre' + (retard.length ? ' alerte' : '') + '" href="#paiements"><small>En retard</small><b>' + euros(somme(retard)) + '</b><span>' + (retard.length ? retard.length + ' à relancer' : 'rien en retard') + '</span></a>' +
      '<a class="chiffre" href="#paiements"><small>Encaissé ce mois</small><b>' + euros(somme(encMois)) + '</b><span class="num">' + esc(FMT_MOIS.format(new Date())) + '</span></a>' +
      '<a class="chiffre" href="#taches"><small>À faire</small><b>' + taches.length + '</b><span>' + attente.length + ' en attente des clients</span></a></div>' +
      '<div class="colonnes"><div>' +
      bloc('Les 7 prochains jours', rdv.length, rdv.length ? rdv.map(function (r) { return ligneRdv(r, true); }).join('') : vide('Rien de prévu cette semaine.'), btnAjout('nouveau-rdv', 'Ajouter')) +
      bloc('À faire', taches.length, taches.length ? taches.slice(0, 12).map(ligneTache).join('') : vide('Tout est fait.'), btnAjout('nouvelle-tache', 'Ajouter')) +
      '</div><div>' +
      bloc('Relances', relances.length, relances.length ? relances.map(function (c) {
        return '<div class="ligne cliquable" data-act="ouvrir-client" data-id="' + c.id + '"><div class="ligne-corps"><b>' + esc(c.nom) + '</b><span>' + esc(c.prochaine || statut(c.statut).l) + '</span></div><div class="ligne-fin"><span class="pastille' + (c.relance <= t ? ' p-rouge' : '') + '">' + esc(quand(c.relance)) + '</span></div></div>';
      }).join('') : vide('Aucune relance cette semaine.')) +
      bloc('En attente des clients', attente.length, attente.length ? attente.map(ligneTache).join('') : vide('Personne ne te doit de réponse.')) +
      bloc('À encaisser', aEnc.length, aEnc.length ? tri(aEnc, function (p) { return p.echeance || '9999'; }).slice(0, 6).map(lignePaiement).join('') : vide('Rien à encaisser.')) +
      '</div></div>';
  }

  /* ----- Calendrier ----- */
  function ecranCalendrier() {
    var t = auj();
    vue.mois = vue.mois || t.slice(0, 7); vue.jour = vue.jour || t;
    var premier = jourDe(vue.mois + '-01'), decal = (premier.getDay() + 6) % 7;
    var debut = plusJours(vue.mois + '-01', -decal);
    var cases = '';
    ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].forEach(function (j) { cases += '<div class="jsem">' + j + '</div>'; });
    for (var i = 0; i < 42; i++) {
      var j = plusJours(debut, i);
      if (i === 35 && j.slice(0, 7) !== vue.mois) break;
      var ev = evenements(j), cls = 'case-jour' + (j.slice(0, 7) !== vue.mois ? ' autre' : '') + (j === t ? ' auj' : '') + (j === vue.jour ? ' choisi' : '');
      cases += '<button type="button" class="' + cls + '" data-act="jour" data-jour="' + j + '"><span class="n">' + jourDe(j).getDate() + '</span>' +
        ev.slice(0, 3).map(function (e) { return '<span class="evt ' + e.type + '">' + esc(e.court) + '</span>'; }).join('') +
        (ev.length > 3 ? '<span class="evt">+' + (ev.length - 3) + '</span>' : '') +
        '<span class="points">' + ev.slice(0, 4).map(function (e) { return '<i class="' + e.type + '"></i>'; }).join('') + '</span></button>';
    }
    var evJour = evenements(vue.jour);
    var titreMois = FMT_MOIS.format(premier);
    return '<div class="tete"><div><h1>Calendrier</h1></div><div class="actions">' + btnAjout('nouveau-rdv', 'Rendez-vous', ' data-jour="' + vue.jour + '"') + '</div></div>' +
      '<div class="colonnes cal"><section class="bloc"><div class="mois-tete"><button class="btn btn-petit" type="button" data-act="mois" data-n="-1" aria-label="Mois précédent">' + I.gauche + '</button>' +
      '<h2>' + esc(titreMois) + '</h2><button class="btn btn-petit" type="button" data-act="mois" data-n="1" aria-label="Mois suivant">' + I.droite + '</button>' +
      '<button class="btn btn-petit" type="button" data-act="mois" data-n="0">Aujourd’hui</button></div>' +
      '<div class="mois">' + cases + '</div><div class="legende"><span>Rendez-vous</span><span class="l-tache">Tâche à rendre</span><span class="l-paiement">Paiement attendu</span></div></section>' +
      '<div>' + bloc(esc(FMT_LONG.format(jourDe(vue.jour))), null, evJour.length ? evJour.map(function (e) { return e.html; }).join('') : vide('Rien ce jour-là.'),
        btnAjout('nouveau-rdv', 'Rendez-vous', ' data-jour="' + vue.jour + '"')) + '</div></div>';
  }
  function evenements(j) {
    var l = [];
    tri(D.rdv.filter(function (r) { return r.date === j; }), function (r) { return r.heure || ''; }).forEach(function (r) {
      l.push({ type: 'rdv', court: (r.heure ? r.heure.replace(':', 'h') + ' ' : '') + r.titre, html: ligneRdv(r) });
    });
    D.taches.filter(function (x) { return !x.fait && x.echeance === j; }).forEach(function (x) { l.push({ type: 'tache', court: x.titre, html: ligneTache(x) }); });
    D.paiements.filter(function (p) { return p.statut !== 'paye' && p.echeance === j; }).forEach(function (p) {
      l.push({ type: 'paiement', court: euros(p.montant) + ' ' + (nomClient(p.client) || p.libelle), html: lignePaiement(p) });
    });
    return l;
  }

  /* ----- Clients ----- */
  function ecranClients() {
    var f = vue.filtreClient, q = vue.recherche.toLowerCase();
    var l = D.clients.filter(function (c) {
      if (f === 'actifs' && (c.statut === 'perdu')) return false;
      if (f !== 'actifs' && f !== 'tous' && c.statut !== f) return false;
      return !q || [c.nom, c.contact, c.ville, c.tel, c.email].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var ordre = STATUTS.map(function (s) { return s.v; });
    l = tri(l, function (c) { return p2(ordre.indexOf(c.statut)) + c.nom.toLowerCase(); });
    var filtres = [{ v: 'actifs', l: 'Tous les actifs' }].concat(STATUTS.map(function (s) { return { v: s.v, l: s.l }; }));
    return '<div class="tete"><div><h1>Clients</h1><p class="sous">' + D.clients.length + ' fiche' + (D.clients.length > 1 ? 's' : '') + '</p></div><div class="actions">' +
      '<input class="recherche" type="search" placeholder="Rechercher" value="' + esc(vue.recherche) + '" data-champ="recherche" aria-label="Rechercher un client">' +
      btnAjout('nouveau-client', 'Client') + '</div></div>' +
      '<div class="filtres">' + filtres.map(function (x) {
        var n = x.v === 'actifs' ? D.clients.filter(function (c) { return c.statut !== 'perdu'; }).length : D.clients.filter(function (c) { return c.statut === x.v; }).length;
        return '<button type="button" class="filtre' + (f === x.v ? ' actif' : '') + '" data-act="filtre-client" data-v="' + x.v + '">' + esc(x.l) + ' · ' + n + '</button>';
      }).join('') + '</div>' +
      (l.length ? '<div class="cartes">' + l.map(carteClient).join('') + '</div>' : vide('Aucun client ici.'));
  }
  function carteClient(c) {
    var offre = [c.creation ? euros(c.creation) : '', c.mensuel ? euros(c.mensuel) + '/mois' : ''].filter(Boolean).join(' + ');
    return '<button type="button" class="carte" data-act="ouvrir-client" data-id="' + c.id + '"><div class="carte-tete"><b>' + esc(c.nom) + '</b>' + pastilleStatut(c.statut) + '</div>' +
      '<span>' + esc([c.contact, c.ville].filter(Boolean).join(' · ') || '—') + '</span>' +
      (offre ? '<span class="num">' + esc(offre) + '</span>' : '') +
      (c.prochaine ? '<span class="prochain">→ ' + esc(c.prochaine) + '</span>' : '') + '</button>';
  }

  function ecranFiche(id) {
    var c = client(id);
    if (!c) return '<a class="retour" href="#clients">' + I.retour + 'Clients</a>' + vide('Ce client n’existe plus.');
    var t = auj();
    var rdv = tri(D.rdv.filter(function (r) { return r.client === id && r.date >= t; }), function (r) { return r.date + (r.heure || ''); });
    var taches = tri(D.taches.filter(function (x) { return x.client === id; }), function (x) { return (x.fait ? '1' : '0') + (x.echeance || '9999'); });
    var paiements = tri(D.paiements.filter(function (p) { return p.client === id; }), function (p) { return (p.statut === 'paye' ? '1' : '0') + (p.echeance || p.payeLe || ''); });
    var tel = (c.tel || '').replace(/[^\d+]/g, ''), wa = tel.replace(/^0/, '33').replace(/^\+/, '');
    var coord = [
      c.contact ? '<div>' + I.clients + esc(c.contact) + '</div>' : '',
      c.tel ? '<a href="tel:' + esc(tel) + '">' + I.tel + esc(c.tel) + '</a><a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' : '',
      c.email ? '<a href="mailto:' + esc(c.email) + '">' + I.mail + esc(c.email) + '</a>' : '',
      c.adresse ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.adresse) + '" target="_blank" rel="noopener">' + I.lieu + esc(c.adresse) + '</a>' : '',
      c.site ? '<a href="' + esc(c.site) + '" target="_blank" rel="noopener">' + I.lien + esc(c.site.replace(/^https?:\/\//, '')) + '</a>' : '',
      c.siret ? '<div>' + I.fichier + 'SIRET ' + esc(c.siret) + '</div>' : '',
    ].join('');
    var journal = tri(c.journal || [], function (n) { return n.d; }).reverse();
    return '<a class="retour" href="#clients">' + I.retour + 'Clients</a>' +
      '<div class="tete"><div><h1>' + esc(c.nom) + '</h1><p class="sous">' + pastilleStatut(c.statut) + (c.prochaine ? ' &nbsp;→ ' + esc(c.prochaine) : '') + '</p></div>' +
      '<div class="actions"><button class="btn" type="button" data-act="modifier-client" data-id="' + id + '">Modifier</button>' +
      btnAjout('nouveau-rdv', 'RDV', ' data-client="' + id + '"') + btnAjout('nouvelle-tache', 'Tâche', ' data-client="' + id + '"') + btnAjout('nouveau-paiement', 'Paiement', ' data-client="' + id + '"') + '</div></div>' +
      '<div class="colonnes"><div>' +
      '<section class="bloc"><div class="bloc-tete"><h2>Coordonnées</h2></div><div class="fiche-coord">' + (coord || vide('Aucune coordonnée.')) + '</div></section>' +
      '<section class="bloc"><div class="bloc-tete"><h2>Offre</h2></div><div class="tarif">' +
      '<div><small>Création</small><b>' + (c.creation ? euros(c.creation) : '—') + '</b></div>' +
      '<div><small>Par mois</small><b>' + (c.mensuel ? euros(c.mensuel) : '—') + '</b></div>' +
      '<div><small>Engagement</small><b>' + (c.engagement ? c.engagement + ' mois' : 'sans') + '</b></div></div>' +
      (c.offre ? '<p class="note-libre" style="margin-top:10px">' + esc(c.offre) + '</p>' : '') +
      (c.debutAbo ? '<p class="vide">Abonnement depuis le ' + esc(FMT_JOUR.format(jourDe(c.debutAbo))) + '</p>' : '') +
      (c.relance ? '<p class="vide">Relance prévue ' + esc(quand(c.relance)) + '</p>' : '') + '</section>' +
      (c.notes ? '<section class="bloc"><div class="bloc-tete"><h2>Notes</h2></div><p class="note-libre">' + esc(c.notes) + '</p></section>' : '') +
      '<section class="bloc"><div class="bloc-tete"><h2>Historique<small>' + journal.length + '</small></h2></div>' +
      '<form class="journal-ajout" data-form="journal" data-id="' + id + '"><input name="t" placeholder="Ex. : appel, devis envoyé, il réfléchit…" aria-label="Ajouter une note" required><button class="btn" type="submit">Ajouter</button></form>' +
      '<div class="liste" style="margin-top:6px">' + journal.map(function (n) {
        return '<div class="ligne"><div class="ligne-corps"><b style="font-weight:400">' + esc(n.t) + '</b><span>' + esc(quand(n.d.slice(0, 10))) + '</span></div><div class="ligne-fin"><button class="btn-lien btn" type="button" data-act="suppr-note" data-id="' + id + '" data-note="' + n.id + '" aria-label="Supprimer la note">×</button></div></div>';
      }).join('') + '</div></section>' +
      '</div><div>' +
      bloc('Rendez-vous à venir', rdv.length, rdv.length ? rdv.map(function (r) { return ligneRdv(r, true); }).join('') : vide('Aucun rendez-vous prévu.'), btnAjout('nouveau-rdv', 'Ajouter', ' data-client="' + id + '"')) +
      bloc('Tâches', taches.filter(function (x) { return !x.fait; }).length, taches.length ? taches.map(ligneTache).join('') : vide('Aucune tâche.'), btnAjout('nouvelle-tache', 'Ajouter', ' data-client="' + id + '"')) +
      bloc('Paiements', null, paiements.length ? paiements.map(lignePaiement).join('') : vide('Aucun paiement.'), btnAjout('nouveau-paiement', 'Ajouter', ' data-client="' + id + '"')) +
      bloc('Fichiers', (c.fichiers || []).length, (c.fichiers || []).length ? c.fichiers.map(function (f) {
        return '<div class="ligne"><div class="ligne-corps cliquable" data-act="voir-fichier" data-chemin="' + esc(f.chemin) + '" style="cursor:pointer"><b>' + esc(f.nom) + '</b><span>' + esc(Math.max(1, Math.round(f.taille / 1024)) + ' Ko · ' + quand((f.d || '').slice(0, 10))) + '</span></div>' +
          '<div class="ligne-fin"><button class="btn btn-lien" type="button" data-act="suppr-fichier" data-id="' + id + '" data-chemin="' + esc(f.chemin) + '" aria-label="Supprimer le fichier">×</button></div></div>';
      }).join('') : vide('Devis, factures, photos, KBIS…'),
        '<label class="btn btn-petit" style="cursor:pointer">' + I.plus + ' Ajouter<input type="file" multiple hidden data-envoi="' + id + '"></label>') +
      '</div></div>';
  }

  /* ----- Taches ----- */
  function ecranTaches() {
    var moi = tri(aFaireMoi(), function (x) { return x.echeance || '9999'; });
    var client_ = tri(D.taches.filter(function (x) { return !x.fait && x.qui === 'client'; }), function (x) { return x.echeance || '9999'; });
    var faites = tri(D.taches.filter(function (x) { return x.fait; }), function (x) { return x.faitLe || ''; }).reverse();
    return '<div class="tete"><div><h1>Tâches</h1><p class="sous">' + moi.length + ' à faire · ' + client_.length + ' en attente des clients</p></div><div class="actions">' + btnAjout('nouvelle-tache', 'Tâche') + '</div></div>' +
      '<section class="bloc"><form class="grille-form form-rapide" data-form="tache-rapide">' +
      '<input name="titre" placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche" required>' + selectClient('', 'client') +
      '<select name="qui" aria-label="Qui doit agir"><option value="moi">À moi</option><option value="client">Au client</option></select>' +
      '<input name="echeance" type="date" aria-label="Échéance"><button class="btn btn-rouge" type="submit">Ajouter</button></form></section>' +
      '<div class="colonnes" style="margin-top:16px"><div>' + bloc('À moi', moi.length, moi.length ? moi.map(ligneTache).join('') : vide('Tout est fait.')) + '</div><div>' +
      bloc('En attente des clients', client_.length, client_.length ? client_.map(ligneTache).join('') : vide('Rien en attente.')) +
      bloc('Faites', faites.length, vue.tachesFaites ? faites.slice(0, 40).map(ligneTache).join('') || vide('Rien encore.') : '',
        '<button class="btn btn-petit" type="button" data-act="voir-faites">' + (vue.tachesFaites ? 'Masquer' : 'Afficher') + '</button>') +
      '</div></div>';
  }

  /* ----- Paiements ----- */
  function ecranPaiements() {
    var t = auj(), mois = t.slice(0, 7), an = t.slice(0, 4);
    var somme = function (l) { return l.reduce(function (s, p) { return s + (p.montant || 0); }, 0); };
    var payes = D.paiements.filter(function (p) { return p.statut === 'paye'; });
    var attendus = D.paiements.filter(function (p) { return p.statut !== 'paye'; });
    var retard = enRetard();
    var f = vue.filtrePaiement;
    var l = f === 'attendu' ? tri(attendus, function (p) { return p.echeance || '9999'; }) : f === 'paye' ? tri(payes, function (p) { return p.payeLe || ''; }).reverse() : tri(D.paiements, function (p) { return p.echeance || p.payeLe || ''; }).reverse();
    var actifs = D.clients.filter(function (c) { return c.mensuel && c.statut === 'en_ligne'; });
    var manquants = actifs.filter(function (c) { return !D.paiements.some(function (p) { return p.client === c.id && p.mois === mois; }); });
    var nomMois = FMT_MOIS.format(new Date()).split(' ')[0];
    return '<div class="tete"><div><h1>Paiements</h1></div><div class="actions">' + btnAjout('nouveau-paiement', 'Paiement') + '</div></div>' +
      '<div class="chiffres">' +
      '<div class="chiffre"><small>À encaisser</small><b>' + euros(somme(attendus)) + '</b><span>' + attendus.length + ' en attente</span></div>' +
      '<div class="chiffre' + (retard.length ? ' alerte' : '') + '"><small>En retard</small><b>' + euros(somme(retard)) + '</b><span>' + retard.length + ' paiement' + (retard.length > 1 ? 's' : '') + '</span></div>' +
      '<div class="chiffre"><small>Encaissé en ' + esc(nomMois) + '</small><b>' + euros(somme(payes.filter(function (p) { return (p.payeLe || '').slice(0, 7) === mois; }))) + '</b><span>ce mois-ci</span></div>' +
      '<div class="chiffre"><small>Encaissé en ' + an + '</small><b>' + euros(somme(payes.filter(function (p) { return (p.payeLe || '').slice(0, 4) === an; }))) + '</b><span>chiffre d’affaires</span></div></div>' +
      '<div class="colonnes"><div><div class="filtres">' + [['attendu', 'À encaisser'], ['paye', 'Encaissés'], ['tous', 'Tous']].map(function (x) {
        return '<button type="button" class="filtre' + (f === x[0] ? ' actif' : '') + '" data-act="filtre-paiement" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>' + bloc(f === 'paye' ? 'Encaissés' : f === 'attendu' ? 'À encaisser' : 'Tous les paiements', l.length, l.length ? l.map(lignePaiement).join('') : vide('Rien ici.')) + '</div><div>' +
      bloc('Abonnements en cours', actifs.length, actifs.length ? actifs.map(function (c) {
        return '<div class="ligne cliquable" data-act="ouvrir-client" data-id="' + c.id + '"><div class="ligne-corps"><b>' + esc(c.nom) + '</b><span>' + (c.engagement ? 'engagé ' + c.engagement + ' mois' : 'sans engagement') + (c.debutAbo ? ' · depuis ' + esc(FMT_JOUR.format(jourDe(c.debutAbo))) : '') + '</span></div><div class="ligne-fin"><span class="montant">' + euros(c.mensuel) + '</span></div></div>';
      }).join('') + '<div class="ligne"><div class="ligne-corps"><b>Total par mois</b></div><div class="ligne-fin"><span class="montant">' + euros(actifs.reduce(function (s, c) { return s + c.mensuel; }, 0)) + '</span></div></div>' : vide('Aucun client en ligne avec abonnement.'),
        manquants.length ? '<button class="btn btn-petit btn-rouge" type="button" data-act="mensualites">Créer les ' + manquants.length + ' mensualité' + (manquants.length > 1 ? 's' : '') + ' de ' + esc(nomMois) + '</button>' : '') +
      '</div></div>';
  }

  /* ---------------- fenetres (formulaires) ---------------- */
  function selectClient(val, nom) {
    return '<select name="' + (nom || 'client') + '" aria-label="Client"><option value="">— Aucun client —</option>' +
      tri(D.clients, function (c) { return c.nom.toLowerCase(); }).map(function (c) { return '<option value="' + c.id + '"' + (c.id === val ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select>';
  }
  function champ(l, html, large) { return '<label class="champ' + (large ? ' large' : '') + '">' + l + html + '</label>'; }
  function inp(nom, val, type, extra) { return '<input name="' + nom + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '>'; }

  var fenetreAction = null;
  function ouvrir(titre, corps, enregistrerFn, supprimerFn, extraPied) {
    fermer();
    var v = document.createElement('div');
    v.className = 'voile'; v.id = 'voile';
    v.innerHTML = '<form class="fenetre" data-form="fenetre" role="dialog" aria-modal="true" aria-label="' + esc(titre) + '"><h2>' + esc(titre) + '</h2>' + corps +
      '<div class="fenetre-pied">' + (supprimerFn ? '<button class="btn btn-danger" type="button" data-act="fenetre-suppr">Supprimer</button>' : '') + (extraPied || '') +
      '<div class="droite"><button class="btn" type="button" data-act="fermer">Annuler</button><button class="btn btn-rouge" type="submit">Enregistrer</button></div></div></form>';
    document.body.appendChild(v);
    fenetreAction = { ok: enregistrerFn, suppr: supprimerFn };
    var premier = v.querySelector('input:not([type=hidden]), select, textarea'); if (premier) premier.focus();
  }
  function fermer() { var v = document.getElementById('voile'); if (v) v.remove(); fenetreAction = null; }
  function valeurs(form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; }

  function formClient(c) {
    c = c || { id: uid(), statut: 'prospect', journal: [], fichiers: [], cree: new Date().toISOString() };
    var nouveau = !client(c.id);
    ouvrir(nouveau ? 'Nouveau client' : 'Modifier ' + c.nom,
      '<div class="grille-form">' + champ('Nom de l’entreprise', inp('nom', c.nom, 'text', ' required'), true) +
      champ('Contact', inp('contact', c.contact)) + champ('Statut', '<select name="statut">' + STATUTS.map(function (s) { return '<option value="' + s.v + '"' + (s.v === c.statut ? ' selected' : '') + '>' + s.l + '</option>'; }).join('') + '</select>') +
      champ('Téléphone', inp('tel', c.tel, 'tel')) + champ('E-mail', inp('email', c.email, 'email')) +
      champ('Adresse', inp('adresse', c.adresse), true) + champ('Ville', inp('ville', c.ville)) + champ('SIRET', inp('siret', c.siret)) +
      champ('Création (€)', inp('creation', enEuros(c.creation), 'text', ' inputmode="decimal"')) + champ('Par mois (€)', inp('mensuel', enEuros(c.mensuel), 'text', ' inputmode="decimal"')) +
      champ('Engagement (mois)', inp('engagement', c.engagement || '', 'number', ' min="0"')) + champ('Abonnement depuis le', inp('debutAbo', c.debutAbo, 'date')) +
      champ('Détail de l’offre', inp('offre', c.offre, 'text', ' placeholder="Ex. : site + fiche Google, 1 % des paiements"'), true) +
      champ('Site ou aperçu', inp('site', c.site, 'url', ' placeholder="https://"'), true) +
      champ('Prochaine étape', inp('prochaine', c.prochaine, 'text', ' placeholder="Ex. : attendre le devis signé"'), true) + champ('Relancer le', inp('relance', c.relance, 'date')) +
      champ('Notes', '<textarea name="notes">' + esc(c.notes) + '</textarea>', true) + '</div>',
      function (v) {
        var el = Object.assign({}, c, v, { creation: centimes(v.creation), mensuel: centimes(v.mensuel), engagement: parseInt(v.engagement, 10) || 0 });
        enregistrer('clients', el, nouveau ? 'Client ajouté' : 'Fiche enregistrée');
        if (nouveau) location.hash = '#client/' + el.id;
      },
      nouveau ? null : function () {
        if (!confirm('Supprimer la fiche « ' + c.nom + ' » ? Ses RDV, tâches et paiements restent, sans client.')) return false;
        supprimer('clients', c.id, 'Fiche supprimée'); location.hash = '#clients';
      });
  }
  function formRdv(r, defauts) {
    defauts = defauts || {};
    r = r || { id: uid(), date: defauts.jour || auj(), heure: '', duree: 60, client: defauts.client || '' };
    var nouveau = !D.rdv.some(function (x) { return x.id === r.id; });
    var c = client(r.client);
    ouvrir(nouveau ? 'Nouveau rendez-vous' : 'Rendez-vous',
      '<div class="grille-form">' + champ('Objet', inp('titre', r.titre, 'text', ' required placeholder="Ex. : présentation de l’espace pro"'), true) +
      champ('Client', selectClient(r.client), true) + champ('Date', inp('date', r.date, 'date', ' required')) + champ('Heure', inp('heure', r.heure, 'time')) +
      champ('Durée (min)', inp('duree', r.duree || 60, 'number', ' min="5" step="5"')) + champ('Lieu', inp('lieu', r.lieu || (nouveau && c ? c.adresse : ''), 'text', ' placeholder="Adresse, téléphone, visio…"')) +
      champ('Note', '<textarea name="note">' + esc(r.note) + '</textarea>', true) + '</div>',
      function (v) { enregistrer('rdv', Object.assign({}, r, v, { duree: parseInt(v.duree, 10) || 60 }), nouveau ? 'Rendez-vous ajouté' : 'Rendez-vous enregistré'); },
      nouveau ? null : function () { if (!confirm('Supprimer ce rendez-vous ?')) return false; supprimer('rdv', r.id, 'Rendez-vous supprimé'); },
      nouveau ? '' : '<button class="btn" type="button" data-act="ics" data-id="' + r.id + '">Ajouter à mon agenda</button>');
  }
  function formTache(t, defauts) {
    defauts = defauts || {};
    t = t || { id: uid(), qui: 'moi', fait: false, client: defauts.client || '' };
    var nouveau = !D.taches.some(function (x) { return x.id === t.id; });
    ouvrir(nouveau ? 'Nouvelle tâche' : 'Tâche',
      '<div class="grille-form">' + champ('Tâche', inp('titre', t.titre, 'text', ' required'), true) + champ('Client', selectClient(t.client), true) +
      champ('Qui doit agir', '<select name="qui"><option value="moi"' + (t.qui !== 'client' ? ' selected' : '') + '>Moi</option><option value="client"' + (t.qui === 'client' ? ' selected' : '') + '>Le client (j’attends sa réponse)</option></select>') +
      champ('Pour le', inp('echeance', t.echeance, 'date')) + '</div>',
      function (v) { enregistrer('taches', Object.assign({}, t, v), nouveau ? 'Tâche ajoutée' : 'Tâche enregistrée'); },
      nouveau ? null : function () { if (!confirm('Supprimer cette tâche ?')) return false; supprimer('taches', t.id, 'Tâche supprimée'); });
  }
  function formPaiement(p, defauts) {
    defauts = defauts || {};
    p = p || { id: uid(), statut: 'attendu', client: defauts.client || '', echeance: auj() };
    var nouveau = !D.paiements.some(function (x) { return x.id === p.id; });
    ouvrir(nouveau ? 'Nouveau paiement' : 'Paiement',
      '<div class="grille-form">' + champ('Client', selectClient(p.client), true) +
      champ('Pour quoi', inp('libelle', p.libelle, 'text', ' required placeholder="Ex. : création du site, acompte 50 %"'), true) +
      champ('Montant (€)', inp('montant', enEuros(p.montant), 'text', ' inputmode="decimal" required')) + champ('Échéance', inp('echeance', p.echeance, 'date')) +
      champ('Statut', '<select name="statut"><option value="attendu"' + (p.statut !== 'paye' ? ' selected' : '') + '>À encaisser</option><option value="paye"' + (p.statut === 'paye' ? ' selected' : '') + '>Encaissé</option></select>') +
      champ('Mode', '<select name="mode"><option value="">—</option>' + MODES.map(function (m) { return '<option' + (m === p.mode ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>') +
      champ('Encaissé le', inp('payeLe', p.payeLe, 'date')) + '</div>',
      function (v) {
        var el = Object.assign({}, p, v, { montant: centimes(v.montant) });
        if (el.statut === 'paye' && !el.payeLe) el.payeLe = auj();
        if (el.statut !== 'paye') el.payeLe = '';
        enregistrer('paiements', el, nouveau ? 'Paiement ajouté' : 'Paiement enregistré');
      },
      nouveau ? null : function () { if (!confirm('Supprimer ce paiement ?')) return false; supprimer('paiements', p.id, 'Paiement supprimé'); });
  }
  function formEncaisser(p) {
    ouvrir('Encaisser ' + euros(p.montant),
      '<p class="vide" style="margin-bottom:12px">' + esc([nomClient(p.client), p.libelle].filter(Boolean).join(' · ')) + '</p><div class="grille-form">' +
      champ('Mode', '<select name="mode">' + MODES.map(function (m) { return '<option' + (m === (p.mode || 'Virement') ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>') +
      champ('Encaissé le', inp('payeLe', auj(), 'date', ' required')) + '</div>',
      function (v) { enregistrer('paiements', Object.assign({}, p, { statut: 'paye', mode: v.mode, payeLe: v.payeLe || auj() }), 'Encaissé ✓'); });
  }

  function telechargerIcs(r) {
    var debut = r.date.replace(/-/g, '') + (r.heure ? 'T' + r.heure.replace(':', '') + '00' : '');
    var fin;
    if (r.heure) { var d = new Date(r.date + 'T' + r.heure); d.setMinutes(d.getMinutes() + (r.duree || 60)); fin = ymd(d).replace(/-/g, '') + 'T' + p2(d.getHours()) + p2(d.getMinutes()) + '00'; }
    else fin = plusJours(r.date, 1).replace(/-/g, '');
    var e = function (s) { return String(s || '').replace(/[\\,;]/g, function (x) { return '\\' + x; }).replace(/\n/g, '\\n'); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LocWeb//Organisation//FR', 'BEGIN:VEVENT', 'UID:' + r.id + '@organisation.locweb',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      (r.heure ? 'DTSTART;TZID=Europe/Paris:' : 'DTSTART;VALUE=DATE:') + debut, (r.heure ? 'DTEND;TZID=Europe/Paris:' : 'DTEND;VALUE=DATE:') + fin,
      'SUMMARY:' + e(r.titre + (nomClient(r.client) ? ' — ' + nomClient(r.client) : '')), 'LOCATION:' + e(r.lieu), 'DESCRIPTION:' + e(r.note),
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'rdv-' + r.date + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function envoyerFichiers(id, fichiers) {
    var c = client(id); if (!c) return;
    var liste = Array.prototype.slice.call(fichiers);
    var suite = Promise.resolve(), ajoutes = 0;
    toast('Envoi de ' + liste.length + ' fichier' + (liste.length > 1 ? 's' : '') + '…');
    liste.forEach(function (f) {
      suite = suite.then(function () {
        if (f.size > 15 * 1024 * 1024) { toast('« ' + f.name + ' » dépasse 15 Mo.', true); return; }
        return new Promise(function (ok, ko) {
          var lecteur = new FileReader();
          lecteur.onload = function () { ok(String(lecteur.result).split(',')[1]); };
          lecteur.onerror = ko; lecteur.readAsDataURL(f);
        }).then(function (b64) {
          var nom = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);
          var chemin = 'fichiers/' + id + '/' + Date.now().toString(36) + '-' + nom;
          return appel('fichier_envoyer', { chemin: chemin, type: f.type, contenu: b64 }).then(function (r) {
            c.fichiers = (c.fichiers || []).concat([{ chemin: chemin, nom: f.name, taille: r.taille, type: f.type, d: new Date().toISOString() }]);
            ajoutes++;
          });
        });
      });
    });
    suite.then(function () { if (ajoutes) enregistrer('clients', c, ajoutes + ' fichier' + (ajoutes > 1 ? 's' : '') + ' ajouté' + (ajoutes > 1 ? 's' : '')); })
      .catch(function (e) { toast(e.message, true); if (ajoutes) enregistrer('clients', c); });
  }

  /* ---------------- evenements ---------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (e.target.id === 'voile') { fermer(); return; }
    if (!b) return;
    var a = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    var trouve = function (rub) { return D[rub].find(function (x) { return x.id === id; }); };
    switch (a) {
      case 'fermer': fermer(); break;
      case 'fenetre-suppr': if (fenetreAction && fenetreAction.suppr && fenetreAction.suppr() !== false) fermer(); break;
      case 'theme': {
        var suiv = { auto: 'light', light: 'dark', dark: 'auto' }[lire('org-theme') || 'auto'];
        ecrire('org-theme', suiv === 'auto' ? null : suiv); appliquerTheme(); rendre(); break;
      }
      case 'actualiser': charger().then(function () { toast('À jour'); }); break;
      case 'deconnexion': if (confirm('Se déconnecter de cet appareil ?')) deconnecter(); break;
      case 'nouveau-rdv': formRdv(null, { jour: b.getAttribute('data-jour'), client: b.getAttribute('data-client') }); break;
      case 'rdv': formRdv(Object.assign({}, trouve('rdv'))); break;
      case 'ics': telechargerIcs(trouve('rdv')); break;
      case 'nouvelle-tache': formTache(null, { client: b.getAttribute('data-client') }); break;
      case 'tache': formTache(Object.assign({}, trouve('taches'))); break;
      case 'cocher': {
        var t = Object.assign({}, trouve('taches')); t.fait = b.checked; t.faitLe = b.checked ? auj() : '';
        enregistrer('taches', t, t.fait ? 'Fait ✓' : 'Remise à faire'); break;
      }
      case 'voir-faites': vue.tachesFaites = !vue.tachesFaites; rendre(); break;
      case 'nouveau-paiement': formPaiement(null, { client: b.getAttribute('data-client') }); break;
      case 'paiement': formPaiement(Object.assign({}, trouve('paiements'))); break;
      case 'encaisser': formEncaisser(Object.assign({}, trouve('paiements'))); break;
      case 'filtre-paiement': vue.filtrePaiement = b.getAttribute('data-v'); rendre(); break;
      case 'mensualites': {
        var mois = auj().slice(0, 7), nom = FMT_MOIS.format(new Date());
        D.clients.filter(function (c) { return c.mensuel && c.statut === 'en_ligne' && !D.paiements.some(function (p) { return p.client === c.id && p.mois === mois; }); }).forEach(function (c) {
          var jour = c.debutAbo ? Math.min(28, jourDe(c.debutAbo).getDate()) : 5;
          enregistrer('paiements', { id: uid(), client: c.id, libelle: 'Abonnement ' + nom, montant: c.mensuel, echeance: mois + '-' + p2(jour), statut: 'attendu', mois: mois }, 'Mensualités créées');
        });
        break;
      }
      case 'nouveau-client': formClient(); break;
      case 'modifier-client': formClient(Object.assign({}, client(id))); break;
      case 'ouvrir-client': location.hash = '#client/' + id; break;
      case 'filtre-client': vue.filtreClient = b.getAttribute('data-v'); rendre(); break;
      case 'suppr-note': {
        var c = Object.assign({}, client(id)); c.journal = (c.journal || []).filter(function (n) { return n.id !== b.getAttribute('data-note'); });
        enregistrer('clients', c, 'Note supprimée'); break;
      }
      case 'voir-fichier': {
        var w = window.open('', '_blank');
        appel('fichier_lien', { chemin: b.getAttribute('data-chemin') }).then(function (r) { if (w) w.location = r.url; else location.href = r.url; })
          .catch(function (er) { if (w) w.close(); toast(er.message, true); });
        break;
      }
      case 'suppr-fichier': {
        var cl = Object.assign({}, client(id)), ch = b.getAttribute('data-chemin');
        if (!confirm('Supprimer ce fichier ?')) break;
        cl.fichiers = (cl.fichiers || []).filter(function (f) { return f.chemin !== ch; });
        appel('fichier_supprimer', { chemin: ch }).catch(function () {});
        enregistrer('clients', cl, 'Fichier supprimé'); break;
      }
      case 'jour': {
        vue.jour = b.getAttribute('data-jour');
        if (vue.jour.slice(0, 7) !== vue.mois) vue.mois = vue.jour.slice(0, 7);
        rendre(); break;
      }
      case 'mois': {
        var n = +b.getAttribute('data-n');
        if (!n) { vue.mois = auj().slice(0, 7); vue.jour = auj(); }
        else { var d = jourDe(vue.mois + '-01'); d.setMonth(d.getMonth() + n); vue.mois = ymd(d).slice(0, 7); }
        rendre(); break;
      }
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, nom = f.getAttribute('data-form');
    if (!nom) return;
    e.preventDefault();
    var v = valeurs(f);
    if (nom === 'connexion') {
      var bouton = f.querySelector('button'); bouton.disabled = true;
      appel('connexion', { code: v.code }).then(function (r) { jeton = r.jeton; ecrire('org-jeton', jeton); rendre(); return charger(); })
        .catch(function (er) { bouton.disabled = false; toast(er.message, true); });
    } else if (nom === 'fenetre') {
      if (fenetreAction && fenetreAction.ok) fenetreAction.ok(v);
      fermer();
    } else if (nom === 'journal') {
      var c = Object.assign({}, client(f.getAttribute('data-id')));
      c.journal = (c.journal || []).concat([{ id: uid(), d: new Date().toISOString(), t: v.t }]);
      enregistrer('clients', c, 'Note ajoutée');
    } else if (nom === 'tache-rapide') {
      enregistrer('taches', { id: uid(), titre: v.titre, client: v.client, qui: v.qui, echeance: v.echeance, fait: false }, 'Tâche ajoutée');
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.getAttribute('data-champ') === 'recherche') {
      vue.recherche = e.target.value; rendre();
      var r = app.querySelector('[data-champ=recherche]'); r.focus(); r.setSelectionRange(r.value.length, r.value.length);
    }
  });
  document.addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-envoi');
    if (id && e.target.files.length) envoyerFichiers(id, e.target.files);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  window.addEventListener('hashchange', function () { fermer(); window.scrollTo(0, 0); rendre(); });
  // Retour sur l'appli (telephone deverrouille, onglet repris) : on recharge.
  document.addEventListener('visibilitychange', function () { if (!document.hidden && jeton && !document.getElementById('voile')) charger(); });

  function appliquerTheme() {
    var t = lire('org-theme');
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  }
  appliquerTheme();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  rendre();
  if (jeton) charger();
})();
