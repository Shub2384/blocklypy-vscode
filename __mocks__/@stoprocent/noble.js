module.exports = {
    on: jest.fn(),
    Peripheral: jest.fn(),
    PeripheralAdvertisement: jest.fn(),
    withBindings: jest.fn(() => ({
        on: jest.fn(),
        off: jest.fn(),
    })),
    Characteristic: jest.fn(),
    Descriptor: jest.fn(),
    Service: jest.fn(),
    // Mock other functions or classes as needed
    // Add any other exports your code uses
};
