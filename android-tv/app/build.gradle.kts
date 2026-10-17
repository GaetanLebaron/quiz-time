plugins {
    id("com.android.application")
}

android {
    namespace = "fr.quiztime.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "fr.quiztime.tv"
        minSdk = 21
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
