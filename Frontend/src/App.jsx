import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import AIPlanner from "./pages/AIPlanner";
import AIMentor from "./pages/AIMentor";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/profile" element={<Profile />} />

        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/projects" element={<Projects />} />

        <Route path="/tasks" element={<Tasks />} />

        <Route path="/ai-planner" element={<AIPlanner />} />

        <Route path="/ai-mentor" element={<AIMentor />} />

        <Route path="/analytics" element={<Analytics />} />

        <Route path="/settings" element={<Settings />} />

        <Route
          path="*"
          element={<Navigate to="/" />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;



// import "./App.css";
// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// import Home from "./pages/Home";
// import Login from "./pages/Login";
// import Register from "./pages/Register";
// import Dashboard from "./pages/Dashboard";
// import Projects from "./pages/Projects";
// import Tasks from "./pages/Tasks";
// import AIPlanner from "./pages/AIPlanner";
// import AIMentor from "./pages/AIMentor";
// import Analytics from "./pages/Analytics";
// import Settings from "./pages/Settings";

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>

//         {/* Welcome Page */}
//         <Route path="/" element={<Home />} />

//         {/* Authentication */}
//         <Route path="/login" element={<Login />} />
//         <Route path="/register" element={<Register />} />

//         {/* Main Application */}
//         <Route path="/dashboard" element={<Dashboard />} />
//         <Route path="/projects" element={<Projects />} />
//         <Route path="/tasks" element={<Tasks />} />
//         <Route path="/ai-planner" element={<AIPlanner />} />
//         <Route path="/ai-mentor" element={<AIMentor />} />
//         <Route path="/analytics" element={<Analytics />} />
//         <Route path="/settings" element={<Settings />} />

//         {/* Unknown URL */}
//         <Route path="*" element={<Navigate to="/" />} />

//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;













// import "./App.css";
// import {
//   BrowserRouter,
//   Routes,
//   Route
// } from "react-router-dom";

// import Register from "./pages/Register";
// import Dashboard from "./pages/Dashboard";
// function Home() {
//   return (
//     <div>
//       <h1>AI-Guided Academic Project Tracker 🚀</h1>
//       <p>Welcome to your project management platform.</p>

//       <a href="/register">
//         Create Account
//       </a>
//     </div>
//   );
// }

// function Login() {
//   return (
//     <div>
//       <h1>Login 🔐</h1>
//       <p>Welcome back!</p>

//       <a href="/register">
//         Create Account
//       </a>
//     </div>
//   );
// }

// function App() {
//   return (
//     <BrowserRouter>

//       <Routes>

//         <Route
//          path="/dashboard"
//         element={<Dashboard />}
//       />

//         <Route
//           path="/"
//           element={<Home />}
//         />

//         <Route
//           path="/login"
//           element={<Login />}
//         />

//         <Route
//           path="/register"
//           element={<Register />}
//         />

//       </Routes>

//     </BrowserRouter>
//   );
// }

// export default App;





// import "./App.css";
// import { BrowserRouter, Routes, Route } from "react-router-dom";

// function Home() {
//   return (
//     <div>
//       <h1>AI-Guided Academic Project Tracker 🚀</h1>
//       <p>Welcome to your project management platform.</p>
//     </div>
//   );
// }

// function Login() {
//   return (
//     <div>
//       <h1>Login 🔐</h1>
//       <p>Welcome back!</p>
//     </div>
//   );
// }

// function Register() {
//   return (
//     <div>
//       <h1>Create Account 🎓</h1>
//       <p>Register for your project tracker.</p>
//     </div>
//   );
// }

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<Home />} />
//         <Route path="/login" element={<Login />} />
//         <Route path="/register" element={<Register />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;






// function App() {
//   return (
//     <h1>
//       AI Project Tracker is Working! 🚀
//     </h1>
//   );
// }

// export default App;





// import "./App.css";

// import {
//   BrowserRouter,
//   Routes,
//   Route
// } from "react-router-dom";

// import Home from "./pages/Home";
// import Login from "./pages/Login";
// import Register from "./pages/Register";

// function App() {

//   return (

//     <BrowserRouter>

//       <Routes>

//         <Route
//           path="/"
//           element={<Home />}
//         />

//         <Route
//           path="/login"
//           element={<Login />}
//         />

//         <Route
//           path="/register"
//           element={<Register />}
//         />

//       </Routes>

//     </BrowserRouter>

//   );
// }

// export default App;



// import "./App.css";
// import Home from "./pages/Home";

// function App() {
//   return <Home />;
// }

// export default App;


// function App() {
//   return (
//     <div>
//       <h1>AI-Guided Academic Project Progress Tracking Platform</h1>
//       <p>Plan smarter. Track better. Get AI-powered guidance.</p>
//     </div>
//   );
// }

// export default App;



// import { useState } from 'react'
// import heroImg from './assets/hero.png'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <section id="center">
//         <div className="hero">
//           <img src={heroImg} className="base" width="170" height="179" alt="" />
//           <img src={reactLogo} className="framework" alt="React logo" />
//           <img src={viteLogo} className="vite" alt="Vite logo" />
//         </div>
//         <div>
//           <h1>Get started</h1>
//           <p>
//             Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
//           </p>
//         </div>
//         <button
//           type="button"
//           className="counter"
//           onClick={() => setCount((count) => count + 1)}
//         >
//           Count is {count}
//         </button>
//       </section>

//       <div className="ticks"></div>

//       <section id="next-steps">
//         <div id="docs">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#documentation-icon"></use>
//           </svg>
//           <h2>Documentation</h2>
//           <p>Your questions, answered</p>
//           <ul>
//             <li>
//               <a href="https://vite.dev/" target="_blank">
//                 <img className="logo" src={viteLogo} alt="" />
//                 Explore Vite
//               </a>
//             </li>
//             <li>
//               <a href="https://react.dev/" target="_blank">
//                 <img className="button-icon" src={reactLogo} alt="" />
//                 Learn more
//               </a>
//             </li>
//           </ul>
//         </div>
//         <div id="social">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#social-icon"></use>
//           </svg>
//           <h2>Connect with us</h2>
//           <p>Join the Vite community</p>
//           <ul>
//             <li>
//               <a href="https://github.com/vitejs/vite" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#github-icon"></use>
//                 </svg>
//                 GitHub
//               </a>
//             </li>
//             <li>
//               <a href="https://chat.vite.dev/" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#discord-icon"></use>
//                 </svg>
//                 Discord
//               </a>
//             </li>
//             <li>
//               <a href="https://x.com/vite_js" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#x-icon"></use>
//                 </svg>
//                 X.com
//               </a>
//             </li>
//             <li>
//               <a href="https://bsky.app/profile/vite.dev" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#bluesky-icon"></use>
//                 </svg>
//                 Bluesky
//               </a>
//             </li>
//           </ul>
//         </div>
//       </section>

//       <div className="ticks"></div>
//       <section id="spacer"></section>
//     </>
//   )
// }

// export default App
