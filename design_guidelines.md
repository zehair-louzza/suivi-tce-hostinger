{
  "meta": {
    "project": "ANELEC GROUPE — Suivi TCE",
    "goal": "Créer une galerie de maquettes cliquables (sans toucher au code du produit existant) présentant 5 directions UI/UX distinctes, chacune couvrant TOUTES les pages/écrans listés (desktop + mobile).",
    "language": "fr-FR",
    "tech": {
      "frontend": "React (Vite) — fichiers .js/.jsx",
      "styling": "CSS variables + Tailwind utilities (si déjà présent) ; sinon CSS utilitaire minimal",
      "icons": "lucide-react (pas d’emojis)",
      "charts": "recharts",
      "map": "leaflet + tuiles CARTO/OSM"
    },
    "testing": {
      "rule": "Tous les éléments interactifs et informations clés DOIVENT avoir data-testid (kebab-case, rôle fonctionnel)."
    },
    "constraints": {
      "b2b": true,
      "high_density": true,
      "wcag": "AA",
      "no_emojis": true,
      "no_transparent_text_background": true,
      "gradient_rules": "Voir section 'general_ui_ux_design_guidelines_appendix'"
    }
  },

  "gallery_chrome_neutral": {
    "intent": "Chrome neutre qui ne concurrence pas les maquettes. Style 'outil de présentation'.",
    "navigation_shell": {
      "type": "Topbar compacte + rail latéral minimal (optionnel) ; fond gris très clair",
      "layout": "conteneur max-w-[1200px] sur pages texte (audit), plein écran pour viewer",
      "viewer_toolbar": [
        "Sélecteur Direction (5) — segmented control",
        "Sélecteur Écran — combobox searchable",
        "Toggle Desktop/Mobile — switch",
        "Bouton Comparer — ouvre /compare",
        "Bouton Ouvrir dans nouvel onglet"
      ],
      "device_frames": {
        "desktop": "canvas plein écran avec marges 16–24px",
        "mobile": "frame iPhone-like (radius 28, shadow doux) + safe-area"
      }
    },
    "pages": {
      "home": {
        "sections": [
          "Header: 'Galerie de maquettes — ANELEC GROUPE' + sous-texte",
          "Bloc 'Audit UI actuel' (liste courte des problèmes) + objectifs",
          "Grille 5 cartes (une par direction) avec aperçu + tags (Densité, Ton, Navigation)",
          "CTA: 'Ouvrir le viewer'"
        ],
        "data_testids": [
          "gallery-home-open-viewer-button",
          "gallery-direction-card",
          "gallery-audit-section"
        ]
      },
      "viewer": {
        "behavior": [
          "Raccourcis clavier: ←/→ change direction, ↑/↓ change écran",
          "URL sync: /viewer?dir=atlas&screen=dashboard-synthese&device=desktop",
          "Sticky toolbar (pas de gradient)"
        ],
        "data_testids": [
          "gallery-viewer-direction-switcher",
          "gallery-viewer-screen-switcher",
          "gallery-viewer-device-toggle",
          "gallery-viewer-compare-button"
        ]
      },
      "compare": {
        "layout": "Grille 5 colonnes (desktop) / carrousel (mobile) montrant le même écran dans les 5 directions.",
        "controls": [
          "Sélecteur écran",
          "Toggle Desktop/Mobile",
          "Zoom 80/100/120%"
        ],
        "data_testids": [
          "gallery-compare-screen-switcher",
          "gallery-compare-zoom-control"
        ]
      }
    },
    "tokens": {
      "colors": {
        "bg": "#F6F7F9",
        "surface": "#FFFFFF",
        "text": "#111827",
        "muted_text": "#6B7280",
        "border": "#E5E7EB",
        "primary": "#2563EB",
        "focus_ring": "#93C5FD"
      },
      "radius": {"sm": 10, "md": 14, "lg": 18},
      "shadow": {
        "sm": "0 1px 2px rgba(16,24,40,.06)",
        "md": "0 10px 30px rgba(16,24,40,.10)"
      },
      "typography": {
        "font_display": "Space Grotesk",
        "font_body": "Inter",
        "font_mono": "IBM Plex Mono"
      }
    }
  },

  "shared_information_architecture": {
    "screens": [
      "auth-connexion",
      "auth-creation-espace",
      "dashboard-synthese",
      "dashboard-operations",
      "dashboard-analyse",
      "planning-gantt",
      "devis-table",
      "devis-kanban",
      "interventions-table",
      "interventions-kanban",
      "carte-tournees",
      "facturation-bacs",
      "comptabilite-rentabilite",
      "profils-donneurs-ordre",
      "parametres-metier",
      "utilisateurs-acces",
      "mobile-technicien",
      "vitrine-demo",
      "modal-export-excel",
      "modal-envoi-rapport-email",
      "modal-cloture-gps"
    ],
    "global_copy_rules": {
      "tone": "professionnel, clair, sans jargon technique visible",
      "rename_examples": {
        "Workstation Super-Admin": "Console administrateur",
        "Moteur Gantt 60 fps": "Planning",
        "Algorithme TSP 2-Opt": "Optimisation de tournée"
      }
    },
    "status_system": {
      "devis_statuses": ["À préparer", "Envoyé", "En négociation", "Accepté", "Refusé"],
      "intervention_statuses": ["À planifier", "Planifiée", "En cours", "Non terminée", "Terminée — à valider", "Clôturée"],
      "planning_blocks": ["Visite devis", "Travaux", "Urgence"],
      "facturation_buckets": ["À facturer", "À vérifier", "Non éligibles", "Retards & relances", "Facturées"]
    }
  },

  "design_directions": {
    "direction_1_atlas_clarity": {
      "name": "Atlas Clarity",
      "brand_attributes": ["fiable", "structuré", "rapide à lire"],
      "for_who_why": "Pour les équipes bureau (dispatch/ADV) qui vivent dans les tableaux et doivent décider vite. Priorité à la lisibilité, aux repères et à la densité maîtrisée.",
      "navigation_shell": {
        "type": "Sidebar claire + topbar utilitaire minimaliste",
        "notes": "Sidebar 260px (desktop) repliable en rail icônes 72px. Topbar: recherche + notifications + profil uniquement. Les CTA vivent dans l’en-tête de page (pas doublés)."
      },
      "density": {
        "table_row_height": "44px (dense) / 52px (confort)",
        "page_padding": "16px mobile, 24px desktop",
        "card_padding": "16–18px"
      },
      "typography": {
        "google_fonts": {
          "display": "Space Grotesk (600/700)",
          "body": "Inter (400/500/600)",
          "mono": "IBM Plex Mono (500)"
        },
        "scale": {
          "h1": "text-4xl sm:text-5xl lg:text-6xl",
          "h2": "text-base md:text-lg",
          "body": "text-sm md:text-base",
          "small": "text-xs"
        }
      },
      "tokens": {
        "colors": {
          "bg": "#F7F8FA",
          "surface": "#FFFFFF",
          "surface_2": "#F1F5F9",
          "text": "#0F172A",
          "muted_text": "#475569",
          "border": "#E2E8F0",
          "primary": "#1D4ED8",
          "primary_hover": "#1E40AF",
          "accent": "#0EA5A4",
          "focus_ring": "#93C5FD",
          "kpi_good": "#16A34A",
          "kpi_warn": "#F59E0B",
          "kpi_bad": "#DC2626",
          "info": "#0284C7",
          "chart_palette": ["#1D4ED8", "#0EA5A4", "#F59E0B", "#64748B", "#16A34A"]
        },
        "status_colors": {
          "devis": {
            "À préparer": {"bg": "#EEF2FF", "fg": "#3730A3", "border": "#C7D2FE"},
            "Envoyé": {"bg": "#E0F2FE", "fg": "#075985", "border": "#BAE6FD"},
            "En négociation": {"bg": "#FFF7ED", "fg": "#9A3412", "border": "#FED7AA"},
            "Accepté": {"bg": "#ECFDF5", "fg": "#065F46", "border": "#A7F3D0"},
            "Refusé": {"bg": "#FEF2F2", "fg": "#991B1B", "border": "#FECACA"}
          },
          "interventions": {
            "À planifier": {"bg": "#F1F5F9", "fg": "#334155", "border": "#CBD5E1"},
            "Planifiée": {"bg": "#E0F2FE", "fg": "#075985", "border": "#BAE6FD"},
            "En cours": {"bg": "#EEF2FF", "fg": "#3730A3", "border": "#C7D2FE"},
            "Non terminée": {"bg": "#FFF7ED", "fg": "#9A3412", "border": "#FED7AA"},
            "Terminée — à valider": {"bg": "#F0FDFA", "fg": "#115E59", "border": "#99F6E4"},
            "Clôturée": {"bg": "#ECFDF5", "fg": "#065F46", "border": "#A7F3D0"}
          },
          "planning_blocks": {
            "Visite devis": {"bg": "#E0F2FE", "fg": "#075985"},
            "Travaux": {"bg": "#ECFDF5", "fg": "#065F46"},
            "Urgence": {"bg": "#FEF2F2", "fg": "#991B1B"}
          }
        },
        "radius": {"sm": 10, "md": 14, "lg": 18},
        "shadow": {
          "card": "0 1px 2px rgba(16,24,40,.06)",
          "overlay": "0 18px 50px rgba(16,24,40,.18)"
        },
        "borders": {"style": "1px solid var(--border)", "table_header": "#F1F5F9"}
      },
      "components": {
        "buttons": {
          "primary": "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          "secondary": "bg-white border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]",
          "ghost": "bg-transparent hover:bg-[var(--surface-2)] text-[var(--text)]",
          "icon": "h-9 w-9 rounded-[var(--radius-sm)]"
        },
        "inputs": {
          "base": "h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          "search": "pl-9"
        },
        "tabs": "underline + compteur (badge) ; sticky sous topbar",
        "badges": "pills non-wrap: inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border",
        "kpi_cards": "4 KPIs en grille 2x2 (desktop) + 1 ligne secondaire (pas 4+1 orphelin).",
        "tables": {
          "pattern": "Header clair (pas noir), colonnes essentielles, actions dans menu '…' + 1 action primaire.",
          "sticky_header": true,
          "row_hover": "bg-slate-50",
          "horizontal_overflow": "utiliser colonnes repliables + 'Détails' drawer"
        },
        "drawers": "Fiche devis/intervention en drawer droite 480–560px, avec onglets (Résumé, Pièces, Photos, Historique).",
        "modals": "Largeur 560px, footer sticky avec actions.",
        "toasts": "sonner — messages courts, sans jargon"
      },
      "screen_mock_rules": {
        "auth": {
          "layout": "Split-screen: gauche formulaire, droite visuel sobre (photo chantier floutée + overlay uni).",
          "elements": [
            "Connexion: Google 1-clic + email/mot de passe",
            "Création espace: SIRET/SIREN, CGU/RGPD, bannière 'Activation e-mail requise'"
          ]
        },
        "dashboard": {
          "synthese": [
            "4 KPI principaux + mini sparkline",
            "Liste 'À traiter en priorité' (tri par impact € / retard)",
            "Planning du jour (mini timeline)"
          ],
          "operations": [
            "Capacité équipes (barres empilées par technicien)",
            "Listes actionnables: devis acceptés à convertir, visites à planifier, devis à relancer, interventions à facturer"
          ],
          "analyse": [
            "Funnel 5 étapes",
            "Pipeline € + taux transformation + panier moyen",
            "CA par donneur d’ordre (bar chart) + table par corps d’état"
          ]
        },
        "planning": {
          "gantt": "Canvas 07:00–19:00, now-line, drag/drop, side panel 'Bourse de dispatch', filtres, Auto-planifier, vues Timeline/Semaine/Agenda."
        },
        "map": {
          "tiles": "CARTO voyager",
          "cockpit": "Mode plein écran avec panneau latéral par technicien (progress, étapes, retard)."
        },
        "mobile": {
          "pattern": "Bottom nav 4 items (Missions, Carte, Pointage, Profil).",
          "cards": "Missions du jour en cards, CTA principal en bas (thumb zone).",
          "gps_modal": "Blocage clôture si GPS absent + explication RGPD courte."
        }
      },
      "pros_cons": {
        "pros": ["Lisibilité maximale", "Densité maîtrisée", "Très 'enterprise'"],
        "cons": ["Moins 'marque' émotionnelle", "Peut sembler classique"]
      }
    },

    "direction_2_craft_warmth": {
      "name": "Craft Warmth",
      "brand_attributes": ["humain", "terrain", "rassurant"],
      "for_who_why": "Pour des équipes mixtes bureau/terrain. Style chaleureux (sans être 'fun') qui réduit la froideur ERP et améliore l’adoption.",
      "navigation_shell": {
        "type": "Top navigation + sous-navigation contextuelle (tabs) + panneau latéral droit optionnel",
        "notes": "Pas de sidebar lourde: plus d’espace horizontal pour tableaux/Gantt."
      },
      "density": {
        "table_row_height": "48px",
        "page_padding": "16px mobile, 28px desktop",
        "card_padding": "18–20px"
      },
      "typography": {
        "google_fonts": {
          "display": "Merriweather Sans (700)",
          "body": "Work Sans (400/500/600)",
          "mono": "Roboto Mono (500)"
        }
      },
      "tokens": {
        "colors": {
          "bg": "#FAF7F2",
          "surface": "#FFFFFF",
          "surface_2": "#F3EFE7",
          "text": "#1F2937",
          "muted_text": "#6B7280",
          "border": "#E7E0D6",
          "primary": "#0F766E",
          "primary_hover": "#115E59",
          "accent": "#D97706",
          "focus_ring": "#99F6E4",
          "chart_palette": ["#0F766E", "#D97706", "#2563EB", "#64748B", "#16A34A"]
        },
        "status_colors": {
          "principle": "Statuts plus 'terre' (teal/ambre/argile) avec fonds très clairs pour éviter l’agressivité.",
          "devis": {
            "À préparer": {"bg": "#F3EFE7", "fg": "#5B4636", "border": "#E7E0D6"},
            "Envoyé": {"bg": "#E0F2FE", "fg": "#075985", "border": "#BAE6FD"},
            "En négociation": {"bg": "#FFF7ED", "fg": "#9A3412", "border": "#FED7AA"},
            "Accepté": {"bg": "#ECFDF5", "fg": "#065F46", "border": "#A7F3D0"},
            "Refusé": {"bg": "#FEF2F2", "fg": "#991B1B", "border": "#FECACA"}
          }
        },
        "radius": {"sm": 12, "md": 16, "lg": 22},
        "shadow": {
          "card": "0 1px 2px rgba(17,24,39,.06)",
          "overlay": "0 22px 60px rgba(17,24,39,.18)"
        },
        "borders": {"style": "1px solid var(--border)", "table_header": "#F3EFE7"}
      },
      "components": {
        "buttons": {
          "primary": "rounded-[16px] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
          "secondary": "rounded-[16px] bg-white border border-[var(--border)] hover:bg-[var(--surface-2)]",
          "ghost": "rounded-[16px] hover:bg-[var(--surface-2)]"
        },
        "cards": "Coins plus ronds + séparateurs fins + titres en display font.",
        "tables": "Zébrage très léger (bg #FBFAF7) + actions en menu.",
        "kanban": "Colonnes avec en-têtes 'capsule' + compteur, cartes avec bande latérale couleur statut.",
        "empty_states": "Illustrations Lottie sobres (outils/plan) en monochrome teal."
      },
      "map": {"tiles": "CARTO positron"},
      "mobile": {
        "pattern": "Bottom nav + gros bouton 'Photo' contextuel dans fiche intervention.",
        "touch_targets": "min 44px"
      },
      "pros_cons": {
        "pros": ["Plus chaleureux", "Très bon pour adoption terrain", "Moins 'ERP froid'"],
        "cons": ["Moins 'ultra-dense' que Atlas", "Risque de paraître 'soft' si mal contrasté"]
      }
    },

    "direction_3_signal_command": {
      "name": "Signal Command",
      "brand_attributes": ["opérationnel", "temps réel", "pilotage"],
      "for_who_why": "Pour les dispatchers qui pilotent planning + carte en continu. Interface cockpit, orientée commandes et raccourcis.",
      "navigation_shell": {
        "type": "Slim icon rail (gauche) + header contextuel + panneau commande (droite)",
        "notes": "Rail 64px (icônes + tooltips). Panneau droit: filtres, actions rapides, 'bourse de dispatch'."
      },
      "density": {
        "table_row_height": "44px",
        "page_padding": "12px mobile, 20px desktop",
        "card_padding": "14–16px"
      },
      "typography": {
        "google_fonts": {
          "display": "IBM Plex Sans (700)",
          "body": "IBM Plex Sans (400/500/600)",
          "mono": "IBM Plex Mono (500)"
        }
      },
      "tokens": {
        "colors": {
          "bg": "#0B1220",
          "surface": "#0F1A2E",
          "surface_2": "#111F38",
          "text": "#E5E7EB",
          "muted_text": "#A3AAB8",
          "border": "#22314D",
          "primary": "#38BDF8",
          "primary_hover": "#0EA5E9",
          "accent": "#F59E0B",
          "focus_ring": "#7DD3FC",
          "chart_palette": ["#38BDF8", "#F59E0B", "#34D399", "#A78BFA", "#94A3B8"]
        },
        "status_colors": {
          "principle": "Fond sombre + pills lumineuses (mais non fluo).",
          "planning_blocks": {
            "Visite devis": {"bg": "rgba(56,189,248,.18)", "fg": "#7DD3FC"},
            "Travaux": {"bg": "rgba(52,211,153,.16)", "fg": "#34D399"},
            "Urgence": {"bg": "rgba(248,113,113,.16)", "fg": "#FCA5A5"}
          }
        },
        "radius": {"sm": 10, "md": 14, "lg": 18},
        "shadow": {
          "card": "0 1px 0 rgba(255,255,255,.04), 0 18px 50px rgba(0,0,0,.45)",
          "overlay": "0 30px 80px rgba(0,0,0,.55)"
        },
        "borders": {"style": "1px solid var(--border)", "table_header": "#111F38"}
      },
      "components": {
        "buttons": {
          "primary": "bg-[var(--primary)] text-[#06121F] hover:bg-[var(--primary-hover)]",
          "secondary": "bg-transparent border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]",
          "ghost": "hover:bg-[var(--surface-2)]"
        },
        "command_palette": "Ctrl+K ouvre une palette (recherche: devis, interventions, techniciens, actions).",
        "tables": "Colonnes compactes + survol met en évidence la ligne + raccourcis (Entrée ouvre drawer).",
        "gantt": "Now-line très visible + mini-map timeline en bas + zoom (jour/semaine).",
        "map": "Mode cockpit plein écran par défaut, panneau droit avec toggles Positions/Trajet/Les deux."
      },
      "map": {"tiles": "CARTO dark_all"},
      "mobile": {
        "pattern": "Mode sombre par défaut pour terrain nuit + gros CTA 'Démarrer' / 'Clôturer'.",
        "note": "Toujours garantir contraste AA (texte #E5E7EB sur surfaces #0F1A2E)."
      },
      "pros_cons": {
        "pros": ["Excellent pour planning/carte", "Sensation 'temps réel'", "Très distinct"],
        "cons": ["Moins adapté aux longues lectures", "Risque de fatigue si trop sombre partout (prévoir surfaces claires dans vitrine)" ]
      }
    },

    "direction_4_editorial_swiss": {
      "name": "Editorial Swiss",
      "brand_attributes": ["premium", "rigoureux", "très lisible"],
      "for_who_why": "Pour une image plus 'cabinet / industriel' premium. Grille typographique suisse, beaucoup d’air, hiérarchie nette.",
      "navigation_shell": {
        "type": "Header horizontal + sidebar contextuelle (section) + breadcrumbs",
        "notes": "Chaque module a sa mini-sidebar (filtres, vues) ; le contenu reste central et aligné."
      },
      "density": {
        "table_row_height": "52px (confort)",
        "page_padding": "18px mobile, 32px desktop",
        "card_padding": "20–24px"
      },
      "typography": {
        "google_fonts": {
          "display": "Söhne-like alternative: 'Manrope' (700/800)",
          "body": "Karla (400/500/600)",
          "mono": "Source Code Pro (500)"
        },
        "style": "Titres en uppercase léger (tracking-wide) + chiffres en mono."
      },
      "tokens": {
        "colors": {
          "bg": "#FFFFFF",
          "surface": "#FFFFFF",
          "surface_2": "#F8FAFC",
          "text": "#0B1220",
          "muted_text": "#475569",
          "border": "#E2E8F0",
          "primary": "#0B3B8F",
          "primary_hover": "#082F6B",
          "accent": "#E07A5F",
          "focus_ring": "#BFDBFE",
          "chart_palette": ["#0B3B8F", "#E07A5F", "#2A9D8F", "#64748B", "#F2CC8F"]
        },
        "radius": {"sm": 8, "md": 12, "lg": 16},
        "shadow": {"card": "0 1px 0 rgba(2,6,23,.06)", "overlay": "0 24px 70px rgba(2,6,23,.18)"},
        "borders": {"style": "1px solid var(--border)", "table_header": "#F8FAFC"}
      },
      "components": {
        "buttons": {
          "primary": "rounded-[10px] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
          "secondary": "rounded-[10px] border border-[var(--border)] bg-white hover:bg-[var(--surface-2)]",
          "ghost": "rounded-[10px] hover:bg-[var(--surface-2)]"
        },
        "tables": "Très typographique: colonnes alignées, séparateurs fins, pas de zébrage fort.",
        "kpi": "KPIs en bande horizontale (4) + sous-KPIs en liste à droite.",
        "kanban": "Colonnes minimalistes, cartes très propres, badges fins."
      },
      "map": {"tiles": "CARTO positron"},
      "mobile": {"pattern": "Cartes très lisibles + typographie forte, bottom nav minimal."},
      "pros_cons": {
        "pros": ["Image premium", "Lisibilité exceptionnelle", "Très 'pro'"],
        "cons": ["Moins 'terrain'", "Peut sembler austère si trop blanc"]
      }
    },

    "direction_5_bento_modular": {
      "name": "Bento Modular",
      "brand_attributes": ["moderne", "modulaire", "orienté widgets"],
      "for_who_why": "Pour un rendu très contemporain et flexible: dashboards en bento grid, modules réarrangeables, lecture par blocs.",
      "navigation_shell": {
        "type": "Floating inset sidebar (glass-lite sans transparence derrière texte) + header",
        "notes": "Sidebar dans un panneau 'inset' (surface_2) avec ombre douce ; contenu en cartes bento."
      },
      "density": {
        "table_row_height": "48px",
        "page_padding": "16px mobile, 24px desktop",
        "card_padding": "16–20px"
      },
      "typography": {
        "google_fonts": {
          "display": "Exo 2 (700)",
          "body": "Figtree (400/500/600)",
          "mono": "JetBrains Mono (500)"
        }
      },
      "tokens": {
        "colors": {
          "bg": "#F5F7FB",
          "surface": "#FFFFFF",
          "surface_2": "#EEF2FF",
          "text": "#0F172A",
          "muted_text": "#475569",
          "border": "#DDE3F0",
          "primary": "#2563EB",
          "primary_hover": "#1D4ED8",
          "accent": "#22C55E",
          "focus_ring": "#A5B4FC",
          "chart_palette": ["#2563EB", "#22C55E", "#F59E0B", "#06B6D4", "#64748B"]
        },
        "radius": {"sm": 14, "md": 18, "lg": 24},
        "shadow": {"card": "0 10px 30px rgba(15,23,42,.08)", "overlay": "0 30px 90px rgba(15,23,42,.18)"},
        "borders": {"style": "1px solid var(--border)", "table_header": "#EEF2FF"}
      },
      "components": {
        "cards": "Bento: tailles variées (1x1, 2x1, 2x2). Chaque carte a un header compact + actions.",
        "buttons": {
          "primary": "rounded-[18px] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
          "secondary": "rounded-[18px] bg-white border border-[var(--border)] hover:bg-[var(--surface-2)]",
          "ghost": "rounded-[18px] hover:bg-[var(--surface-2)]"
        },
        "tables": "Tables dans cartes avec header sticky interne + pagination compacte.",
        "kanban": "Colonnes en cartes bento, scroll horizontal avec snap.",
        "micro_interactions": "Hover: légère élévation (shadow) + border accent ; press: scale(0.98)."
      },
      "map": {"tiles": "CARTO voyager"},
      "mobile": {
        "pattern": "Widgets empilés + bottom sheet pour filtres (au lieu de sidebars)."
      },
      "pros_cons": {
        "pros": ["Très moderne", "Flexible", "Bon pour dashboards"],
        "cons": ["Risque de 'trop de cartes'", "À cadrer pour rester enterprise"]
      }
    }
  },

  "component_path": {
    "note": "Le repo /app/frontend n’a pas de shadcn/ui présent (dossier components/ui absent). Pour la galerie, implémenter des composants maison en .jsx/.js inspirés shadcn (Button, Input, Tabs, Badge, Drawer, Dialog, Table, Tooltip, DropdownMenu, Sheet).",
    "recommended_structure": [
      "/app/frontend/src/components/chrome/* (toolbar, device frame)",
      "/app/frontend/src/components/screens/* (écrans partagés)",
      "/app/frontend/src/components/dir-shells/* (5 shells)",
      "/app/frontend/src/styles/tokens.css (variables par direction via [data-dir])"
    ]
  },

  "instructions_to_main_agent": [
    "NE PAS modifier /app/client ni /app/server (produit). Construire uniquement la galerie dans /app/frontend.",
    "Créer un système de thèmes via attribut data-dir sur <body> ou un wrapper: [data-dir='atlas'] { --bg: ... }.",
    "Créer un set d’écrans partagés (même markup) et 5 shells (layout) qui changent uniquement la navigation + densité + tokens.",
    "Chaque écran doit exister en desktop et mobile (toggle device).",
    "Tous les boutons/inputs/toggles/menus/onglets/cartes cliquables doivent avoir data-testid.",
    "Remplacer les titres jargon par libellés métier (voir rename_examples).",
    "Tables: réduire colonnes visibles, utiliser drawer pour détails, actions via menu '…'.",
    "Planning Gantt: prévoir zoom, now-line, drag/drop simulé (mock), bourse de dispatch en panneau.",
    "Carte: Leaflet + tuiles selon direction ; markers techniciens + polyline tournée.",
    "Facturation: 5 bacs en grille 2x3 (desktop) sans orphelin ; sur mobile en accordéon.",
    "Mobile technicien: bottom nav, cartes missions, photo capture CTA, modale GPS obligatoire."
  ],

  "image_urls": {
    "gallery_home": [
      {
        "url": "https://images.unsplash.com/photo-1600132806370-bf17e65e942f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwyfHxjb25zdHJ1Y3Rpb24lMjBtYW5hZ2VtZW50JTIwZGFzaGJvYXJkJTIwYWJzdHJhY3R8ZW58MHx8fGJsdWV8MTc5NDA3MDY4MHww&ixlib=rb-4.1.0&q=85",
        "category": "hero",
        "description": "Visuel neutre (wireframes) pour la page d’accueil de la galerie — à flouter et assombrir légèrement via overlay uni."
      }
    ],
    "auth_side_visual": [
      {
        "url": "https://images.unsplash.com/photo-1590935216109-8d3318de2c1c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwzfHxjb25zdHJ1Y3Rpb24lMjBtYW5hZ2VtZW50JTIwZGFzaGJvYXJkJTIwYWJzdHJhY3R8ZW58MHx8fGJsdWV8MTc5NDA3MDY4MHww&ixlib=rb-4.1.0&q=85",
        "category": "auth",
        "description": "Image d’ambiance abstraite pour le panneau droit des écrans Connexion/Création espace (overlay solide, pas de texte dessus)."
      }
    ]
  },

  "libraries_and_scaffolds": {
    "fonts": {
      "implementation": "Charger via Google Fonts dans index.html de /app/frontend (ou via @import dans CSS). Prévoir fallback system-ui.",
      "example": "<link rel='preconnect' href='https://fonts.googleapis.com'> ..."
    },
    "motion": {
      "library": "framer-motion (optionnel)",
      "install": "npm i framer-motion",
      "usage": "Entrées: fade+slide 8–12px ; hover boutons: translateY(-1px) ; drawers: slide-in 240ms."
    },
    "map": {
      "library": "leaflet",
      "tiles": {
        "positron": "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        "voyager": "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        "dark": "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      }
    }
  },

  "accessibility": {
    "rules": [
      "Contraste AA: texte normal >= 4.5:1 ; texte large >= 3:1.",
      "Focus visible: ring 2px + offset 2px.",
      "Touch targets mobile >= 44px.",
      "Ne pas coder l’info uniquement par couleur: ajouter libellés + icônes lucide.",
      "Tables: en-têtes <th> clairs, tri accessible, actions au clavier."
    ]
  },

  "motion_micro_interactions": {
    "principles": [
      "Pas de transition globale (interdit: transition: all).",
      "Hover: boutons et lignes de table uniquement (120–180ms).",
      "Press: scale(0.98) sur boutons primaires.",
      "Drawer/Modal: easing standard (cubic-bezier(0.2, 0.8, 0.2, 1)).",
      "Scroll: sticky headers (tables, toolbar) + ombre apparaît au scroll."
    ]
  },

  "general_ui_ux_design_guidelines_appendix": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
