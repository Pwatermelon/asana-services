// Top-level build file
buildscript {
    repositories {
        google()
        // Российские зеркала для buildscript
        maven {
            url = uri("https://maven.aliyun.com/repository/public/")
            name = "Aliyun Maven"
        }
        maven {
            url = uri("https://repo.maven.apache.org/maven2/")
            name = "Maven Central Apache"
        }
        maven {
            url = uri("https://repo1.maven.org/maven2/")
            name = "Maven Central Repo1"
        }
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.2.2")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22")
        classpath("com.google.dagger:hilt-android-gradle-plugin:2.48")
    }
}

plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("com.google.dagger.hilt.android") version "2.48" apply false
}

tasks.register("clean", Delete::class) {
    delete(rootProject.buildDir)
}
