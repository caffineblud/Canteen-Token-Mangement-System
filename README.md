<div align="center">

# 🍽️ Canteen Token Management System

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Grid_%26_Variables-1572B6?style=flat-square&logo=css3&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0-FF8C00?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-22c55e?style=flat-square)

> A modern, responsive web application designed for college and corporate canteens — featuring categorized menu browsing, FIFO token generation, cross-tab live queue syncing, automated billing with GST calculations, and daily sales analytics.

[![GitHub](https://img.shields.io/badge/GitHub-caffineblud-181717?style=flat-square&logo=github)](https://github.com/caffineblud)

</div>

---

## ✨ Features

| Module | Description |
|---|---|
| 📋 **Menu & Price List** | Categorized items (Snacks, Meals, Beverages, Desserts), search filtering, and admin item toggle/restock |
| 🎟️ **Token Generation** | Daily resetting sequence numbers (`T-001`, `T-002`, etc.) with instant slip generation and print support |
| 🔄 **Order Queue Board** | FIFO queue flow (`Queued` → `Preparing` → `Ready` → `Served`) with real-time multi-tab sync via `localStorage` |
| 💳 **Billing & Taxes** | Automated subtotal, custom admin discount percentages, 5% GST computation, and multiple payment modes (Cash, UPI, Card) |
| 📊 **Daily Sales Analytics** | Revenue KPIs, item breakdown charts, peak order hour distribution, and CSV report export |
| 🌙 **Dark/Light Theme** | System-aware theme switcher with persistent preference storage |

---

## 🗂️ Project Structure

```
canteen-token-system/
│
├── index.html         # 🚀 Main entry point — UI structure, dialogs, and views
├── app.js             # ⚙️ Core business logic, token engine, state management, and UI rendering
├── styles.css         # 🎨 Modern CSS styles with CSS variables and dark mode support
└── README.md          # 📖 Project documentation
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Language** | Vanilla JavaScript (ES6+) | Core application logic, routing, and DOM rendering |
| **Styling** | Modern CSS3 (Grid, Flexbox, Variables) | Responsive layout and dynamic dark/light themes |
| **Storage** | Browser `localStorage` & `sessionStorage` | Persistent menu/orders state and admin session management |
| **Standard Lib** | `window.print`, `Blob`, `URL.createObjectURL` | Token slip printing and CSV report downloads |

---

## ⚙️ Setup & Installation

Since this is a client-side web application, no complex backend server setup or package installations are required!

```bash
git clone https://github.com/caffineblud/canteen-token-system.git
cd canteen-token-system
```

- **Run Locally:** Simply open `index.html` in any modern web browser.
- **Recommended:** Use a local development server like *Live Server* in VS Code for the best live-reloading experience.

---

## 🔐 Admin Access

Certain administrative features (such as editing menu items, controlling the counter queue, and viewing sales analytics) require authentication.

- **Action:** Click **"Admin login"** in the top navigation bar.
- **Demo Credentials:**
  - **Username:** `admin`
  - **Password:** `admin123`

---

## 💾 Storage & Real-Time Syncing

- All application data is safely stored in the browser's `localStorage` under the key `canteen.v1`.
- **Cross-Tab Syncing:** Open `index.html` in two separate browser tabs (e.g., Tab 1 as the Customer Ordering view, Tab 2 as the Counter Queue) to watch orders sync live instantly across tabs.
- **Data Export & Reset:** Admins can reset daily orders or export the entire sales ledger as a formatted `.csv` file anytime from the Sales report tab.

---

## 👨‍💻 Author & Contributors

<div align="center">

**Group 10**

| Name | GitHub / Profile |
|---|---|
| **Yash Kumar Singh** | [![GitHub](https://img.shields.io/badge/GitHub-caffineblud-181717?style=flat-square&logo=github)](https://github.com/caffineblud) |
| **Md Anis Haidar** | — |
| **Piyush Kumar** | — |
| **Nikhil Kumar** | — |

⭐ If you like this project, consider giving it a star.

</div>
