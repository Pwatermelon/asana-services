pluginManagement {
    repositories {
        google()
        // Российские зеркала для плагинов
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
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        // Российские зеркала Maven Central (более стабильные)
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
        mavenCentral {
            content {
                // Используем как резервный
                excludeGroupByRegex(".*")
            }
        }
    }
}

rootProject.name = "YogaDictApp"
include(":app")

