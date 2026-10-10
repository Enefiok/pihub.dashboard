const CONFIG = {
  API_BASE_URL: 'https://pihub-backend.onrender.com',

  ENDPOINTS: {
    // Auth
    LOGIN: '/api/accounts/login/',
    CREATE_STAFF: '/api/accounts/create-staff/',
    CHANGE_PASSWORD: '/api/accounts/change-password/',

    // Workspaces
    WORKSPACE_PLANS: '/api/workspaces/plans/',
    BOOKINGS: '/api/workspaces/bookings/',
    WORKSPACE_TAGS: '/api/workspaces/tags/',

    // Courses
    COURSES: '/api/courses/',
    STUDENTS: '/api/courses/students/',

    // Certificates
    CERTIFICATES: '/api/certificates/',
    CERTIFICATE_VERIFY: '/api/certificates/verify/',

    // Blog
    BLOG_POSTS_PUBLIC: '/api/blog/posts/',
    BLOG_POSTS_STAFF: '/api/blog/staff/posts/',
    BLOG_CATEGORIES_STAFF: '/api/blog/staff/categories/',

    // Gallery & Enquiries
    GALLERY_PUBLIC: '/api/core/gallery/',
    GALLERY_STAFF: '/api/core/staff/gallery/',
    ENQUIRIES_PUBLIC: '/api/core/enquiries/',
    ENQUIRIES_STAFF: '/api/core/staff/enquiries/',

    // Newsletter
    SUBSCRIBE: '/api/core/subscribe/',
    UNSUBSCRIBE: '/api/core/unsubscribe/',
    NEWSLETTERS: '/api/core/newsletters/',
    SUBSCRIBERS: '/api/core/staff/subscribers/',

    // Payments
    PAYMENTS: '/api/payments/',             // <-- ADD THIS LINE
    PAYMENT_WEBHOOK: '/api/payments/webhook/paystack/',
  },

  STORAGE_KEYS: {
    TOKEN: 'pihub_token',
    USER: 'pihub_user',
  },

  PAGE_SIZE: 10,
};