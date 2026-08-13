import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, List, Play, BarChart2 } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">LLM Red Team</h1>
      </div>
      <nav className="flex-1 py-6 px-4 space-y-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </NavLink>
        
        <NavLink
          to="/prompts"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <List className="w-5 h-5" />
          <span className="font-medium">Prompt Library</span>
        </NavLink>
        
        <NavLink
          to="/evaluation"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Play className="w-5 h-5" />
          <span className="font-medium">Run Evaluation</span>
        </NavLink>
        
        <NavLink
          to="/results"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <BarChart2 className="w-5 h-5" />
          <span className="font-medium">Results</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
