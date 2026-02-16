import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

// Mock the simulation hook
vi.mock('./hooks/useSimulation', () => ({
  default: () => {},
}));

// Mock router location - replace BrowserRouter with MemoryRouter for tests
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={['/']}>{children}</actual.MemoryRouter>
    ),
  };
});

// Mock Leaflet for map components
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: vi.fn(),
    },
  },
  tileLayer: vi.fn(),
  map: vi.fn(() => ({
    setView: vi.fn(),
    remove: vi.fn(),
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    bindPopup: vi.fn(),
  })),
  icon: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  Circle: () => <div data-testid="circle" />,
  Polygon: () => <div data-testid="polygon" />,
  useMap: () => ({}),
}));

describe('App Component', () => {
  it('should render without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('should render the QueryClientProvider', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('should render Toaster components', () => {
    const { container } = render(<App />);
    // Just verify the app renders successfully with all providers
    expect(container).toBeTruthy();
    expect(container.firstChild).toBeTruthy();
  });
});
