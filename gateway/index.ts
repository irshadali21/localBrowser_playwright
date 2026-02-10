/**
 * Gateway Module Index
 * Export all gateway components
 */

// Command Types
export * from './commandTypes';

// Command Registry
export { CommandRegistry, commandRegistry } from './commandRegistry';

// Re-export controller functions for convenience
export {
  handleGatewayCommand,
  getAllCommands,
  healthCheck,
  getMetrics,
} from '../controllers/gatewayController';

// Re-export routes
export { default as gatewayRoutes } from '../routes/gatewayRoutes';
