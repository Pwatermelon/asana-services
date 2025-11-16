package com.yoga.dict

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.yoga.dict.ui.screens.*
import com.yoga.dict.ui.theme.YogaDictTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            YogaDictTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    
                    val authViewModel: com.yoga.dict.ui.viewmodel.AuthViewModel = hiltViewModel()
                    val isAuthenticated by authViewModel.isAuthenticated.collectAsStateWithLifecycle()
                    
                    NavHost(
                        navController = navController,
                        startDestination = if (isAuthenticated) "asana_list" else "login"
                    ) {
                        composable("login") {
                            LoginScreen(
                                onLoginSuccess = { navController.navigate("asana_list") { popUpTo("login") } },
                                onNavigateToRegister = { navController.navigate("register") },
                                onNavigateToResetPassword = { navController.navigate("reset_password") }
                            )
                        }
                        composable("register") {
                            RegisterScreen(
                                onRegisterSuccess = { navController.navigate("login") },
                                onNavigateToLogin = { navController.popBackStack() }
                            )
                        }
                        composable("reset_password") {
                            ResetPasswordScreen(
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable("asana_list") {
                            AsanaListScreen(
                                onAsanaClick = { asana ->
                                    navController.navigate("asana_detail/${asana.id}")
                                },
                                onNavigateToSources = { navController.navigate("sources") },
                                onNavigateToSettings = { navController.navigate("settings") }
                            )
                        }
                        composable("asana_detail/{asanaId}") { backStackEntry ->
                            val asanaId = backStackEntry.arguments?.getString("asanaId") ?: ""
                            AsanaDetailScreen(
                                asanaId = asanaId,
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable("sources") {
                            SourcesListScreen(
                                onSourceClick = { source ->
                                    navController.navigate("source_asanas/${source.id}")
                                },
                                onAddSource = { navController.navigate("add_source") }
                            )
                        }
                        composable("source_asanas/{sourceId}") { backStackEntry ->
                            val sourceId = backStackEntry.arguments?.getString("sourceId") ?: ""
                            SourceAsanasScreen(
                                sourceId = sourceId,
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable("add_source") {
                            AddSourceScreen(
                                onBack = { navController.popBackStack() },
                                onSuccess = { navController.popBackStack() }
                            )
                        }
                        composable("add_asana") {
                            AddAsanaScreen(
                                onBack = { navController.popBackStack() },
                                onSuccess = { navController.popBackStack() }
                            )
                        }
                        composable("settings") {
                            SettingsScreen(
                                onBack = { navController.popBackStack() },
                                onNavigateToModeration = { navController.navigate("moderation") },
                                onNavigateToAbout = { navController.navigate("about") },
                                onNavigateToInstructions = { navController.navigate("instructions") }
                            )
                        }
                        composable("moderation") {
                            ModerationScreen(
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable("about") {
                            AboutProjectScreen(
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable("instructions") {
                            ExpertInstructionsScreen(
                                onBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }
}

